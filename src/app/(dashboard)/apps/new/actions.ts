"use server";

import { redirect } from "next/navigation";
import { appFormBaseSchema, withRuntimeRefinements } from "@/lib/appFormSchema";
import { prisma } from "@/lib/db/prisma";
import { upsertWebproxyRoute } from "@/lib/adapters/webproxy";
import { createDnsRecord, findZoneId } from "@/lib/adapters/cloudflare";
import { config } from "@/lib/config";
import { requireSessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const schema = withRuntimeRefinements(appFormBaseSchema);

export type CreateAppState = { error: string } | null;

// The onboarding wizard from docs/PLANNING.md §3.3 — app registration plus
// the webproxy route and Cloudflare DNS record it needs, all from one form.
// Each infra step is best-effort: a failure there doesn't roll back the App
// row (it's already real and useful on its own), it's surfaced as a warning
// on the redirect target instead.
export async function createApp(
  _prevState: CreateAppState,
  formData: FormData,
): Promise<CreateAppState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  let created: { id: number; name: string };
  try {
    created = await prisma.app.create({ data: parsed.data });
  } catch {
    return { error: "이미 같은 이름의 앱이 등록되어 있습니다." };
  }

  const warnings: string[] = [];
  const domain = parsed.data.domain;
  const wantsProxyRoute = formData.get("createProxyRoute") === "on";
  const wantsDnsRecord = formData.get("createDnsRecord") === "on";

  if (wantsProxyRoute) {
    if (!domain) {
      warnings.push("webproxy 라우팅 생성 건너뜀: 도메인 미입력");
    } else {
      const targetPort = Number(formData.get("proxyTargetPort"));
      if (!targetPort) {
        warnings.push("webproxy 라우팅 생성 건너뜀: 대상 포트 미입력");
      } else {
        const result = await upsertWebproxyRoute({
          host: domain,
          kind: "proxy",
          targetPort,
          preserveHostHeader: formData.get("proxyPreserveHostHeader") === "on",
        });
        if (!result.ok) warnings.push(`webproxy 라우팅 생성 실패: ${result.error}`);
      }
    }
  }

  if (wantsDnsRecord) {
    if (!domain) {
      warnings.push("DNS 레코드 생성 건너뜀: 도메인 미입력");
    } else {
      const zoneName = String(formData.get("dnsZone") || "");
      const zoneIdResult = await findZoneId(zoneName);
      if (!zoneIdResult.ok) {
        warnings.push(`DNS 레코드 생성 실패: ${zoneIdResult.error}`);
      } else if (!config.ORIGIN_IP) {
        warnings.push("DNS 레코드 생성 건너뜀: ORIGIN_IP 미설정");
      } else {
        const dnsResult = await createDnsRecord(zoneIdResult.data, {
          type: "A",
          name: domain,
          content: config.ORIGIN_IP,
          proxied: formData.get("dnsProxied") === "on",
        });
        if (!dnsResult.ok) warnings.push(`DNS 레코드 생성 실패: ${dnsResult.error}`);
      }
    }
  }

  if (wantsProxyRoute || wantsDnsRecord) {
    const user = await requireSessionUser();
    await recordAudit({
      actorEmail: user.email,
      action: "onboard_app",
      appId: created.id,
      appName: created.name,
      success: warnings.length === 0,
      detail: warnings.length > 0 ? warnings.join(" / ") : "webproxy/DNS 자동 생성 완료",
    });
  }

  const query = warnings.length > 0 ? `?onboardWarning=${encodeURIComponent(warnings.join(" / "))}` : "";
  redirect(`/apps/${created.id}${query}`);
}
