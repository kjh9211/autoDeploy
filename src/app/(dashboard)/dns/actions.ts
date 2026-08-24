"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createDnsRecord, findZoneId, updateDnsRecord } from "@/lib/adapters/cloudflare";
import { requireSessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export type DnsActionState = { error: string } | { ok: true } | null;

export async function toggleProxied(
  _prevState: DnsActionState,
  formData: FormData,
): Promise<DnsActionState> {
  const user = await requireSessionUser();
  const zoneId = String(formData.get("zoneId"));
  const recordId = String(formData.get("recordId"));
  const name = String(formData.get("name"));
  const nextProxied = formData.get("nextProxied") === "true";

  const result = await updateDnsRecord(zoneId, recordId, { proxied: nextProxied });

  await recordAudit({
    actorEmail: user.email,
    action: "dns_record_change",
    appId: null,
    appName: name,
    success: result.ok,
    detail: result.ok ? `proxied → ${nextProxied}` : result.error,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/dns");
  return { ok: true };
}

export async function updateContent(
  _prevState: DnsActionState,
  formData: FormData,
): Promise<DnsActionState> {
  const user = await requireSessionUser();
  const zoneId = String(formData.get("zoneId"));
  const recordId = String(formData.get("recordId"));
  const name = String(formData.get("name"));
  const content = String(formData.get("content")).trim();
  if (!content) return { error: "값을 입력해 주세요." };

  const result = await updateDnsRecord(zoneId, recordId, { content });

  await recordAudit({
    actorEmail: user.email,
    action: "dns_record_change",
    appId: null,
    appName: name,
    success: result.ok,
    detail: result.ok ? `content → ${content}` : result.error,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/dns");
  return { ok: true };
}

const createSchema = z.object({
  zoneName: z.string().min(1),
  type: z.enum(["A", "CNAME"]),
  name: z.string().trim().min(1, "이름을 입력해 주세요."),
  content: z.string().trim().min(1, "값을 입력해 주세요."),
  proxied: z.boolean(),
});

export async function createRecord(
  _prevState: DnsActionState,
  formData: FormData,
): Promise<DnsActionState> {
  const user = await requireSessionUser();
  const parsed = createSchema.safeParse({
    zoneName: formData.get("zoneName"),
    type: formData.get("type"),
    name: formData.get("name"),
    content: formData.get("content"),
    proxied: formData.get("proxied") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  const zoneIdResult = await findZoneId(parsed.data.zoneName);
  if (!zoneIdResult.ok) return { error: zoneIdResult.error };

  const result = await createDnsRecord(zoneIdResult.data, {
    type: parsed.data.type,
    name: parsed.data.name,
    content: parsed.data.content,
    proxied: parsed.data.proxied,
  });

  await recordAudit({
    actorEmail: user.email,
    action: "dns_record_change",
    appId: null,
    appName: parsed.data.name,
    success: result.ok,
    detail: result.ok ? "레코드 생성" : result.error,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath("/dns");
  return { ok: true };
}
