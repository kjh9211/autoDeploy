import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { findPm2Process } from "@/lib/adapters/pm2";
import { getWindowsServiceStatus } from "@/lib/adapters/nssm";
import { pm2StatusHealth, windowsServiceHealth } from "@/lib/status";
import { StatusBadge } from "@/components/StatusBadge";
import { AppForm } from "@/components/AppForm";
import { updateApp } from "./actions";
import { UpdateCheckButton } from "./UpdateCheckButton";
import { DeleteAppButton } from "./DeleteAppButton";
import { ControlButtons } from "./ControlButtons";
import { LogViewer } from "./LogViewer";

export default async function AppDetailPage(props: PageProps<"/apps/[id]">) {
  const { id } = await props.params;
  const app = await prisma.app.findUnique({ where: { id: Number(id) } });
  if (!app) notFound();

  const pm2Proc = app.runtime === "pm2" && app.pm2Name ? await findPm2Process(app.pm2Name) : null;
  const svcStatus =
    app.runtime === "nssm" && app.nssmService
      ? await getWindowsServiceStatus(app.nssmService)
      : null;

  const health =
    app.runtime === "pm2"
      ? pm2StatusHealth(pm2Proc?.status)
      : windowsServiceHealth(svcStatus?.ok ? svcStatus.status : undefined);
  const detail =
    app.runtime === "pm2" ? (pm2Proc?.status ?? "PM2에 없음") : svcStatus?.ok ? svcStatus.status : svcStatus?.error;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{app.name}</h1>
          <div className="mt-1">
            <StatusBadge health={health} detail={detail} />
          </div>
        </div>
        <div className="flex items-start gap-2">
          <ControlButtons appId={app.id} health={health} />
          <DeleteAppButton appId={app.id} appName={app.name} />
        </div>
      </div>

      {app.runtime === "pm2" && pm2Proc && (
        <section className="flex flex-col gap-2 text-sm rounded-md border border-black/10 dark:border-white/10 p-4">
          <h2 className="font-medium mb-1">PM2 실행 정보</h2>
          <p>
            인터프리터: {pm2Proc.execInterpreter ?? "—"} · 엔트리:{" "}
            {pm2Proc.execPath ?? "—"}
          </p>
          {!pm2Proc.followsWindowsConvention && (
            <p className="text-amber-600 dark:text-amber-400">
              권장 실행 방식(--interpreter node + .js 엔트리)을 따르지 않습니다 —
              docs/PLANNING.md §6.1 참고.
            </p>
          )}
          <p className="text-black/60 dark:text-white/60">
            CPU {pm2Proc.cpu ?? "—"}% · 메모리{" "}
            {pm2Proc.memoryBytes ? `${Math.round(pm2Proc.memoryBytes / 1024 / 1024)}MB` : "—"}{" "}
            · 재시작 {pm2Proc.restarts ?? "—"}회
          </p>
        </section>
      )}

      {((app.runtime === "pm2" && app.pm2Name) ||
        (app.runtime === "nssm" && app.logPath)) && <LogViewer appId={app.id} />}

      {app.localPath && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">배포</h2>
          <UpdateCheckButton appId={app.id} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">등록 정보 수정</h2>
        <AppForm
          action={updateApp}
          submitLabel="저장"
          defaults={{
            id: app.id,
            name: app.name,
            type: app.type,
            runtime: app.runtime,
            pm2Name: app.pm2Name ?? undefined,
            nssmService: app.nssmService ?? undefined,
            localPath: app.localPath ?? undefined,
            branch: app.branch ?? undefined,
            domain: app.domain ?? undefined,
            logPath: app.logPath ?? undefined,
            notes: app.notes ?? undefined,
          }}
        />
      </section>
    </div>
  );
}
