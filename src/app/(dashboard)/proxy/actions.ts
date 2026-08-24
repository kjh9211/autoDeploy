"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  deleteWebproxyRoute,
  upsertWebproxyRoute,
  type WebproxyRoute,
} from "@/lib/adapters/webproxy";
import { requireSessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const routeSchema = z
  .object({
    host: z.string().trim().min(1, "Host를 입력해 주세요."),
    kind: z.enum(["proxy", "redirect"]),
    targetPort: z.coerce.number().int().positive().optional(),
    preserveHostHeader: z.boolean().optional(),
    redirectTo: z.string().trim().optional(),
  })
  .refine((v) => (v.kind === "proxy" ? !!v.targetPort : true), {
    message: "프록시 라우트는 대상 포트가 필요합니다.",
    path: ["targetPort"],
  })
  .refine((v) => (v.kind === "redirect" ? !!v.redirectTo : true), {
    message: "리다이렉트 라우트는 대상 URL이 필요합니다.",
    path: ["redirectTo"],
  });

export type RouteFormState = { error: string } | { ok: true } | null;

export async function upsertRoute(
  _prevState: RouteFormState,
  formData: FormData,
): Promise<RouteFormState> {
  const user = await requireSessionUser();

  const parsed = routeSchema.safeParse({
    host: formData.get("host"),
    kind: formData.get("kind"),
    targetPort: formData.get("targetPort") || undefined,
    preserveHostHeader: formData.get("preserveHostHeader") === "on",
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  const route: WebproxyRoute =
    parsed.data.kind === "proxy"
      ? {
          host: parsed.data.host,
          kind: "proxy",
          targetPort: parsed.data.targetPort!,
          preserveHostHeader: !!parsed.data.preserveHostHeader,
        }
      : { host: parsed.data.host, kind: "redirect", redirectTo: parsed.data.redirectTo! };

  const result = await upsertWebproxyRoute(route);

  await recordAudit({
    actorEmail: user.email,
    action: "proxy_route_change",
    appId: null,
    appName: route.host,
    success: result.ok,
    detail: result.ok ? undefined : result.error,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/proxy");
  return { ok: true };
}

export async function deleteRoute(formData: FormData) {
  const host = String(formData.get("host"));
  const user = await requireSessionUser();

  const result = await deleteWebproxyRoute(host);

  await recordAudit({
    actorEmail: user.email,
    action: "proxy_route_change",
    appId: null,
    appName: host,
    success: result.ok,
    detail: result.ok ? "삭제" : result.error,
  });

  revalidatePath("/proxy");
}
