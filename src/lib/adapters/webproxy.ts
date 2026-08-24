import { config } from "@/lib/config";

// Client for webproxy's internal admin API — see docs/webproxy-integration.md
// for the reference implementation this contract expects webproxy to expose.
// That app lives outside this repo (docs/PLANNING.md §6.2), so this adapter
// is only verified against a mock server that implements the same contract;
// treat it as unverified against the real webproxy until checked there.

export type WebproxyRoute =
  | { host: string; kind: "proxy"; targetPort: number; preserveHostHeader: boolean }
  | { host: string; kind: "redirect"; redirectTo: string };

type WebproxyResult<T> = { ok: true; data: T } | { ok: false; error: string };

function notConfigured(): WebproxyResult<never> {
  return {
    ok: false,
    error: "WEBPROXY_ADMIN_URL / WEBPROXY_ADMIN_TOKEN이 설정되어 있지 않습니다.",
  };
}

async function call<T>(
  path: string,
  init?: RequestInit,
): Promise<WebproxyResult<T>> {
  if (!config.WEBPROXY_ADMIN_URL || !config.WEBPROXY_ADMIN_TOKEN) {
    return notConfigured();
  }
  try {
    const res = await fetch(`${config.WEBPROXY_ADMIN_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": config.WEBPROXY_ADMIN_TOKEN,
        ...init?.headers,
      },
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, error: body?.error ?? `webproxy가 ${res.status}을 반환했습니다.` };
    }
    return { ok: true, data: body as T };
  } catch (err) {
    return {
      ok: false,
      error:
        "webproxy 관리 API에 연결할 수 없습니다: " +
        (err instanceof Error ? err.message : String(err)),
    };
  }
}

export function listWebproxyRoutes() {
  return call<{ routes: WebproxyRoute[] }>("/routes");
}

export function upsertWebproxyRoute(route: WebproxyRoute) {
  const { host, ...rest } = route;
  return call<{ ok: true }>(`/routes/${encodeURIComponent(host)}`, {
    method: "PUT",
    body: JSON.stringify(rest),
  });
}

export function deleteWebproxyRoute(host: string) {
  return call<{ ok: true }>(`/routes/${encodeURIComponent(host)}`, {
    method: "DELETE",
  });
}

export function reloadWebproxyCerts() {
  return call<{ ok: true; loaded: string[] }>("/certs/reload", { method: "POST" });
}
