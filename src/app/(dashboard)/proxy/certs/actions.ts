"use server";

import { reloadWebproxyCerts } from "@/lib/adapters/webproxy";
import { requireSessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export type ReloadCertsState = { error: string } | { ok: true; loaded: string[] } | null;

// SNI cert reload is a separate mechanism from routing reload (docs/PLANNING.md
// §6.2) — webproxy only re-scans certs/ and re-registers addContext() when
// this is called, not automatically when a file changes.
export async function reloadCerts(): Promise<ReloadCertsState> {
  const user = await requireSessionUser();
  const result = await reloadWebproxyCerts();

  await recordAudit({
    actorEmail: user.email,
    action: "proxy_certs_reload",
    appId: null,
    appName: "webproxy certs",
    success: result.ok,
    detail: result.ok ? `${result.data.loaded.length}개 로드` : result.error,
  });

  if (!result.ok) return { error: result.error };
  return { ok: true, loaded: result.data.loaded };
}
