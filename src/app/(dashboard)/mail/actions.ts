"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDomain, ensureDkim } from "@/lib/adapters/mailcow";
import { requireSessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

export type MailActionState = { error: string } | { ok: true } | null;

const schema = z.object({
  domain: z.string().trim().min(1, "도메인을 입력해 주세요."),
  mailboxes: z.coerce.number().int().positive().default(10),
  quota: z.coerce.number().int().positive().default(3072),
});

// Domain add + DKIM are two mailcow API calls, but always run as one unit —
// docs/PLANNING.md §6.6 says a domain isn't really usable without mailcow's
// own auto-generated DKIM key, and this project never constructs one by hand.
export async function addMailDomain(
  _prevState: MailActionState,
  formData: FormData,
): Promise<MailActionState> {
  const user = await requireSessionUser();
  const parsed = schema.safeParse({
    domain: formData.get("domain"),
    mailboxes: formData.get("mailboxes") || undefined,
    quota: formData.get("quota") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  const domainResult = await addDomain(parsed.data);
  if (!domainResult.ok) {
    await recordAudit({
      actorEmail: user.email,
      action: "mail_domain_add",
      appId: null,
      appName: parsed.data.domain,
      success: false,
      detail: domainResult.error,
    });
    return { error: domainResult.error };
  }

  const dkimResult = await ensureDkim(parsed.data.domain);

  await recordAudit({
    actorEmail: user.email,
    action: "mail_domain_add",
    appId: null,
    appName: parsed.data.domain,
    success: dkimResult.ok,
    detail: dkimResult.ok
      ? "도메인 추가 + DKIM 생성 완료"
      : `도메인은 추가됨, DKIM 생성 실패: ${dkimResult.error}`,
  });

  if (!dkimResult.ok) return { error: `도메인은 추가됐지만 DKIM 생성에 실패했습니다: ${dkimResult.error}` };

  revalidatePath("/mail");
  return { ok: true };
}
