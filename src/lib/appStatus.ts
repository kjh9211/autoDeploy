import { prisma } from "@/lib/db/prisma";
import { listPm2Processes, type Pm2ProcessInfo } from "@/lib/adapters/pm2";
import { getWindowsServiceStatus } from "@/lib/adapters/nssm";
import { pm2StatusHealth, windowsServiceHealth, type Health } from "@/lib/status";
import type { App } from "@/generated/prisma/client";

export type AppWithStatus = {
  app: App;
  health: Health;
  detail: string;
  pm2Proc: Pm2ProcessInfo | null;
};

// Shared by the dashboard summary and the /apps list so both read PM2 exactly
// once per request instead of once per app.
export async function getAppsWithStatus(): Promise<{
  apps: AppWithStatus[];
  pm2Error: string | null;
  pm2ProcessNames: string[];
}> {
  const dbApps = await prisma.app.findMany({ orderBy: { name: "asc" } });
  const pm2Result = await listPm2Processes();
  const pm2ByName = new Map(
    pm2Result.ok ? pm2Result.processes.map((p) => [p.name, p] as const) : [],
  );

  const apps = await Promise.all(
    dbApps.map(async (app): Promise<AppWithStatus> => {
      if (app.runtime === "pm2") {
        const proc = app.pm2Name ? pm2ByName.get(app.pm2Name) : undefined;
        if (!pm2Result.ok) {
          return { app, health: "unknown", detail: "PM2 조회 실패", pm2Proc: null };
        }
        if (!proc) {
          return { app, health: "unknown", detail: "PM2에 없음", pm2Proc: null };
        }
        return { app, health: pm2StatusHealth(proc.status), detail: proc.status, pm2Proc: proc };
      }

      if (!app.nssmService) {
        return { app, health: "unknown", detail: "서비스명 미설정", pm2Proc: null };
      }
      const svc = await getWindowsServiceStatus(app.nssmService);
      if (!svc.ok) {
        return { app, health: "unknown", detail: svc.error, pm2Proc: null };
      }
      return { app, health: windowsServiceHealth(svc.status), detail: svc.status, pm2Proc: null };
    }),
  );

  return {
    apps,
    pm2Error: pm2Result.ok ? null : pm2Result.error,
    pm2ProcessNames: pm2Result.ok ? pm2Result.processes.map((p) => p.name) : [],
  };
}
