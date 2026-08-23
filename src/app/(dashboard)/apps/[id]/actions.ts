"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import type { $Enums } from "@/generated/prisma/client";
import { checkForAppUpdates, type GitUpdateCheck } from "@/lib/adapters/git";
import { controlPm2Process } from "@/lib/adapters/pm2";
import { controlWindowsService } from "@/lib/adapters/nssm";
import { requireSessionUser } from "@/lib/auth/guard";
import { recordAudit } from "@/lib/audit";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const schema = z
  .object({
    id: z.coerce.number().int().positive(),
    name: z.string().trim().min(1, "이름을 입력해 주세요."),
    type: z.enum(["node_app", "static_web", "discord_bot", "minecraft"]),
    runtime: z.enum(["pm2", "nssm"]),
    pm2Name: z.preprocess(emptyToUndefined, z.string().optional()),
    nssmService: z.preprocess(emptyToUndefined, z.string().optional()),
    localPath: z.preprocess(emptyToUndefined, z.string().optional()),
    branch: z.preprocess(emptyToUndefined, z.string().optional()),
    domain: z.preprocess(emptyToUndefined, z.string().optional()),
    logPath: z.preprocess(emptyToUndefined, z.string().optional()),
    notes: z.preprocess(emptyToUndefined, z.string().optional()),
  })
  .refine((v) => (v.runtime === "pm2" ? !!v.pm2Name : true), {
    message: "PM2로 관리되는 앱은 pm2 프로세스 이름이 필요합니다.",
    path: ["pm2Name"],
  })
  .refine((v) => (v.runtime === "nssm" ? !!v.nssmService : true), {
    message: "NSSM으로 관리되는 앱은 서비스 이름이 필요합니다.",
    path: ["nssmService"],
  });

export type UpdateAppState = { error: string } | null;

export async function updateApp(
  _prevState: UpdateAppState,
  formData: FormData,
): Promise<UpdateAppState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  const { id, ...data } = parsed.data;
  try {
    await prisma.app.update({ where: { id }, data });
  } catch {
    return { error: "이미 같은 이름의 앱이 등록되어 있습니다." };
  }

  redirect(`/apps/${id}`);
}

export async function deleteApp(formData: FormData) {
  const id = Number(formData.get("id"));
  await prisma.app.delete({ where: { id } });
  redirect("/apps");
}

export async function checkAppGitUpdate(
  _prevState: GitUpdateCheck | null,
  formData: FormData,
): Promise<GitUpdateCheck | null> {
  const id = Number(formData.get("id"));
  const app = await prisma.app.findUnique({ where: { id } });
  if (!app?.localPath) {
    return { ok: false, error: "이 앱에는 로컬 git 경로가 등록되어 있지 않습니다." };
  }
  return checkForAppUpdates(app.localPath, app.branch ?? "main");
}

const CONTROL_ACTIONS = ["start", "stop", "restart"] as const;
type ControlAction = (typeof CONTROL_ACTIONS)[number];

const AUDIT_ACTION_BY_CONTROL: Record<ControlAction, $Enums.AuditAction> = {
  start: "app_start",
  stop: "app_stop",
  restart: "app_restart",
};

export type ControlAppState = { error: string } | { ok: true } | null;

// Phase 1 control action (docs/PLANNING.md §9). Always logs to AuditLog,
// success or failure — see docs/PLANNING.md §7.
export async function controlApp(
  _prevState: ControlAppState,
  formData: FormData,
): Promise<ControlAppState> {
  const id = Number(formData.get("id"));
  const actionRaw = String(formData.get("action"));
  if (!CONTROL_ACTIONS.includes(actionRaw as ControlAction)) {
    return { error: "잘못된 작업입니다." };
  }
  const action = actionRaw as ControlAction;

  const user = await requireSessionUser();
  const app = await prisma.app.findUnique({ where: { id } });
  if (!app) return { error: "앱을 찾을 수 없습니다." };

  const result =
    app.runtime === "pm2"
      ? app.pm2Name
        ? await controlPm2Process(app.pm2Name, action)
        : { ok: false as const, error: "PM2 프로세스 이름이 설정되어 있지 않습니다." }
      : app.nssmService
        ? await controlWindowsService(app.nssmService, action)
        : { ok: false as const, error: "NSSM 서비스 이름이 설정되어 있지 않습니다." };

  await recordAudit({
    actorEmail: user.email,
    action: AUDIT_ACTION_BY_CONTROL[action],
    appId: app.id,
    appName: app.name,
    success: result.ok,
    detail: result.ok ? undefined : result.error,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath(`/apps/${id}`);
  revalidatePath("/apps");
  revalidatePath("/");
  return { ok: true };
}
