"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireSessionUser } from "@/lib/auth/guard";
import { runDeployPipeline } from "@/lib/deploy/pipeline";

export type StartDeployState = { error: string } | null;

// Kicks off the pipeline (docs/PLANNING.md §6.4) and redirects to its live
// view — the pipeline itself keeps running in this same long-lived process
// even after the redirect (Ops Console is a self-hosted pm2 app, not
// serverless, so nothing tears the process down mid-run).
export async function startDeploy(
  _prevState: StartDeployState,
  formData: FormData,
): Promise<StartDeployState> {
  const appId = Number(formData.get("id"));
  const force = formData.get("force") === "on";

  const user = await requireSessionUser();
  const app = await prisma.app.findUnique({ where: { id: appId } });
  if (!app) return { error: "앱을 찾을 수 없습니다." };
  if (!app.localPath) {
    return { error: "이 앱에는 로컬 git 경로가 없어 배포할 수 없습니다." };
  }

  const alreadyRunning = await prisma.deployLog.findFirst({
    where: { appId, status: "running" },
  });
  if (alreadyRunning) {
    return { error: `이미 진행 중인 배포가 있습니다 (#${alreadyRunning.id}).` };
  }

  const deployLog = await prisma.deployLog.create({
    data: {
      appId: app.id,
      appName: app.name,
      triggeredBy: user.email,
      mode: "update",
      stepsJson: "[]",
    },
  });

  void runDeployPipeline(app, deployLog.id, { kind: "update" }, force, user.email);

  redirect(`/deploys/${deployLog.id}`);
}
