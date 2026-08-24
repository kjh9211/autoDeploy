import { spawn } from "node:child_process";
import simpleGit from "simple-git";
import { prisma } from "@/lib/db/prisma";
import { controlPm2Process, savePm2ProcessList } from "@/lib/adapters/pm2";
import { controlWindowsService } from "@/lib/adapters/nssm";
import { emitDeployEvent, cleanupDeployEmitter } from "@/lib/deploy/events";
import { recordAudit } from "@/lib/audit";
import type { App } from "@/generated/prisma/client";

export type DeployStepRecord = {
  name: string;
  status: "running" | "success" | "failed" | "skipped";
  output: string;
  startedAt: string;
  finishedAt?: string;
};

export type DeployMode =
  | { kind: "update" }
  | { kind: "rollback"; commit: string };

class StepFailedError extends Error {}

// Runs `command` through the shell so admin-entered build/migrate/deploy
// commands (e.g. "npm run build") work as typed — safe here because these
// strings come from the App registry form filled in once by the logged-in
// admin (docs/PLANNING.md §7's "no arbitrary command console" rule is about
// never taking a command from a request; this is trusted configuration, the
// same commands the admin already runs by hand today).
function runShellCommand(
  command: string,
  cwd: string,
  onChunk: (chunk: string) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true });
    child.stdout.on("data", (d: Buffer) => onChunk(d.toString()));
    child.stderr.on("data", (d: Buffer) => onChunk(d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function persistSteps(deployLogId: number, steps: DeployStepRecord[]) {
  await prisma.deployLog.update({
    where: { id: deployLogId },
    data: { stepsJson: JSON.stringify(steps) },
  });
}

async function healthcheck(url: string): Promise<{ ok: boolean; detail: string }> {
  const attempts = 5;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return { ok: true, detail: `${url} → ${res.status}` };
    } catch {
      // fall through to retry
    }
    if (i < attempts) await new Promise((r) => setTimeout(r, 2000));
  }
  return { ok: false, detail: `${url} 응답 없음 (${attempts}회 시도)` };
}

// Runs the whole pipeline for one app and persists+streams progress as it
// goes. Never throws/rejects — the caller (a server action) fires this
// without awaiting it and returns immediately, so an escaping rejection
// would just become a silent unhandled-rejection; every outcome instead
// lands in the DeployLog row.
export async function runDeployPipeline(
  app: App,
  deployLogId: number,
  mode: DeployMode,
  force: boolean,
  triggeredBy: string,
): Promise<void> {
  try {
    await runDeployPipelineInner(app, deployLogId, mode, force, triggeredBy);
  } catch (err) {
    console.error(`[deploy ${deployLogId}] unhandled pipeline error:`, err);
    try {
      await prisma.deployLog.update({
        where: { id: deployLogId },
        data: { status: "failed", finishedAt: new Date() },
      });
    } catch {}
    emitDeployEvent(deployLogId, { type: "done", status: "failed" });
    cleanupDeployEmitter(deployLogId);
  }
}

async function runDeployPipelineInner(
  app: App,
  deployLogId: number,
  mode: DeployMode,
  force: boolean,
  triggeredBy: string,
): Promise<void> {
  const steps: DeployStepRecord[] = [];
  const localPath = app.localPath!;
  const git = simpleGit(localPath);

  async function step(
    name: string,
    fn: (append: (chunk: string) => void) => Promise<{ ok: boolean; skip?: boolean }>,
  ): Promise<void> {
    const record: DeployStepRecord = {
      name,
      status: "running",
      output: "",
      startedAt: new Date().toISOString(),
    };
    steps.push(record);
    emitDeployEvent(deployLogId, { type: "step-start", step: name });
    await persistSteps(deployLogId, steps);

    const append = (chunk: string) => {
      record.output += chunk;
      emitDeployEvent(deployLogId, { type: "output", step: name, chunk });
    };

    let ok: boolean;
    try {
      const result = await fn(append);
      ok = result.ok;
      record.status = result.skip ? "skipped" : ok ? "success" : "failed";
    } catch (err) {
      ok = false;
      record.status = "failed";
      append(`\n${err instanceof Error ? err.message : String(err)}\n`);
    }
    record.finishedAt = new Date().toISOString();
    await persistSteps(deployLogId, steps);
    emitDeployEvent(deployLogId, { type: "step-end", step: name, status: record.status });

    if (!ok) throw new StepFailedError(name);
  }

  async function runCommandStep(name: string, command: string) {
    await step(name, async (append) => {
      const code = await runShellCommand(command, localPath, append);
      return { ok: code === 0 };
    });
  }

  let fromCommit: string | null = null;
  let toCommit: string | null = null;
  let status: "success" | "failed" = "success";

  try {
    fromCommit = (await git.revparse(["HEAD"])).trim();
    await prisma.deployLog.update({ where: { id: deployLogId }, data: { fromCommit } });

    await step("로컬 변경 확인", async (append) => {
      const dirty = (await git.status()).files.map((f) => f.path);
      if (dirty.length === 0) {
        append("커밋되지 않은 변경 없음\n");
        return { ok: true };
      }
      append(`커밋되지 않은 변경: ${dirty.join(", ")}\n`);
      if (!force) {
        append("배포를 중단합니다 — 무시하고 진행하려면 다시 체크박스를 선택하세요.\n");
        return { ok: false };
      }
      append("관리자가 '무시하고 진행'을 선택하여 계속합니다.\n");
      return { ok: true };
    });

    if (mode.kind === "update") {
      const branch = app.branch ?? "main";
      await step("git fetch", async (append) => {
        await git.fetch(["origin", branch]);
        append("fetch 완료\n");
        return { ok: true };
      });

      await step("ff-only 병합", async (append) => {
        try {
          await git.merge(["--ff-only", `origin/${branch}`]);
          append(`origin/${branch}로 병합 완료\n`);
          return { ok: true };
        } catch (err) {
          append(
            "ff-only 병합 실패 — 로컬에 별도 커밋이 있을 수 있습니다. 자동으로 처리하지 않습니다.\n" +
              (err instanceof Error ? err.message : String(err)) +
              "\n",
          );
          return { ok: false };
        }
      });
    } else {
      await step(`롤백 → ${mode.commit.slice(0, 10)}`, async (append) => {
        await git.reset(["--hard", mode.commit]);
        append(`${mode.commit}로 이동 완료\n`);
        return { ok: true };
      });
    }

    toCommit = (await git.revparse(["HEAD"])).trim();

    const diffOutput =
      fromCommit === toCommit
        ? ""
        : await git.diff(["--name-only", `${fromCommit}..${toCommit}`]);
    const changedFiles = diffOutput.split("\n").filter(Boolean);

    if (changedFiles.includes("package.json")) {
      await runCommandStep("npm install", "npm install");
    }

    if (app.migrateCmd && changedFiles.some((f) => f.endsWith("schema.sql"))) {
      await runCommandStep("DB 마이그레이션", app.migrateCmd);
    }

    if (app.buildCmd) {
      await runCommandStep("빌드", app.buildCmd);
    }

    if (
      app.deployCommandsCmd &&
      app.commandsPath &&
      changedFiles.some((f) => f.startsWith(app.commandsPath!))
    ) {
      await runCommandStep("슬래시 커맨드 배포", app.deployCommandsCmd);
    }

    await step("재시작", async (append) => {
      const result =
        app.runtime === "pm2"
          ? app.pm2Name
            ? await controlPm2Process(app.pm2Name, "restart")
            : { ok: false as const, error: "PM2 프로세스 이름 미설정" }
          : app.nssmService
            ? await controlWindowsService(app.nssmService, "restart")
            : { ok: false as const, error: "NSSM 서비스 이름 미설정" };
      append(result.ok ? "재시작 완료\n" : `재시작 실패: ${result.error}\n`);
      return { ok: result.ok };
    });

    if (app.healthcheckUrl) {
      const url = app.healthcheckUrl;
      await step("헬스체크", async (append) => {
        const result = await healthcheck(url);
        append(result.detail + "\n");
        return { ok: result.ok };
      });
    }

    if (app.runtime === "pm2") {
      await step("pm2 save", async (append) => {
        const result = await savePm2ProcessList();
        append(result.ok ? "저장 완료\n" : `저장 실패: ${result.error}\n`);
        return { ok: result.ok };
      });
    }
  } catch (err) {
    status = "failed";
    if (!(err instanceof StepFailedError)) {
      // Something outside a tracked step blew up (e.g. revparse on a repo
      // that vanished) — record it so the run doesn't look like it just
      // silently stopped.
      steps.push({
        name: "예상치 못한 오류",
        status: "failed",
        output: err instanceof Error ? err.message : String(err),
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      });
      await persistSteps(deployLogId, steps);
    }
  }

  await prisma.deployLog.update({
    where: { id: deployLogId },
    data: { status, toCommit, finishedAt: new Date() },
  });

  await recordAudit({
    actorEmail: triggeredBy,
    action: mode.kind === "rollback" ? "app_rollback" : "app_deploy",
    appId: app.id,
    appName: app.name,
    success: status === "success",
    detail: `${fromCommit?.slice(0, 10) ?? "?"} → ${toCommit?.slice(0, 10) ?? "?"}`,
  });

  emitDeployEvent(deployLogId, { type: "done", status });
  cleanupDeployEmitter(deployLogId);
}
