"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireSessionUser } from "@/lib/auth/guard";
import { runDeployPipeline } from "@/lib/deploy/pipeline";

export type RollbackState = { error: string } | null;

// Rolls the app back to the commit a past (successful) deploy left it at —
// docs/PLANNING.md §6.4's "배포 이력에서 이전 커밋 선택 → 동일 파이프라인을
// 그 커밋 기준으로 재실행". Uses `git reset --hard`, not a merge, since
// moving HEAD backward on the server's own deployed checkout is exactly
// what this button is for (see src/lib/deploy/pipeline.ts).
export async function rollbackToDeploy(
  _prevState: RollbackState,
  formData: FormData,
): Promise<RollbackState> {
  const sourceDeployId = Number(formData.get("deployId"));
  const force = formData.get("force") === "on";

  const user = await requireSessionUser();
  const source = await prisma.deployLog.findUnique({ where: { id: sourceDeployId } });
  if (!source?.toCommit) {
    return { error: "롤백할 커밋 정보를 찾을 수 없습니다." };
  }

  const app = await prisma.app.findUnique({ where: { id: source.appId } });
  if (!app?.localPath) {
    return { error: "앱을 찾을 수 없거나 로컬 git 경로가 없습니다." };
  }

  const alreadyRunning = await prisma.deployLog.findFirst({
    where: { appId: app.id, status: "running" },
  });
  if (alreadyRunning) {
    return { error: `이미 진행 중인 배포가 있습니다 (#${alreadyRunning.id}).` };
  }

  const deployLog = await prisma.deployLog.create({
    data: {
      appId: app.id,
      appName: app.name,
      triggeredBy: user.email,
      mode: "rollback",
      stepsJson: "[]",
    },
  });

  void runDeployPipeline(
    app,
    deployLog.id,
    { kind: "rollback", commit: source.toCommit },
    force,
    user.email,
  );

  redirect(`/deploys/${deployLog.id}`);
}
