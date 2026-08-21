import Link from "next/link";
import { getAppsWithStatus } from "@/lib/appStatus";
import { checkDumpPm2Sync } from "@/lib/adapters/dumpPm2";
import { listCerts } from "@/lib/adapters/certs";
import { config } from "@/lib/config";
import { StatusBadge } from "@/components/StatusBadge";

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  const toneClass =
    tone === "danger"
      ? "text-red-600 dark:text-red-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "";
  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-4">
      <p className="text-xs text-black/50 dark:text-white/50">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const [{ apps, pm2Error, pm2ProcessNames }, certsResult] = await Promise.all([
    getAppsWithStatus(),
    listCerts(config.CERTS_DIR),
  ]);

  const unhealthyApps = apps.filter((a) => a.health === "down" || a.health === "unknown");
  const certs = certsResult.ok ? certsResult.certs : [];
  const attentionCerts = certs.filter((c) => c.expiringSoon || c.expired);

  const dumpSync = pm2Error
    ? null
    : await checkDumpPm2Sync(config.DUMP_PM2_PATH, pm2ProcessNames);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">대시보드</h1>
        <p className="text-sm text-black/50 dark:text-white/50 mt-1">
          현재 등록된 앱과 인프라 상태 요약
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="등록된 앱" value={String(apps.length)} />
        <SummaryCard
          label="주의 필요"
          value={String(unhealthyApps.length)}
          tone={unhealthyApps.length > 0 ? "danger" : undefined}
        />
        <SummaryCard
          label="인증서 만료 임박/만료"
          value={String(attentionCerts.length)}
          tone={attentionCerts.length > 0 ? "warn" : undefined}
        />
        <SummaryCard
          label="pm2 save 상태"
          value={dumpSync?.ok ? (dumpSync.inSync ? "동기화됨" : "불일치") : "확인 불가"}
          tone={dumpSync?.ok && !dumpSync.inSync ? "warn" : undefined}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">주의가 필요한 항목</h2>
        {pm2Error && (
          <p className="text-sm text-red-600 dark:text-red-400">
            PM2 조회 실패: {pm2Error}
          </p>
        )}
        {unhealthyApps.length === 0 && attentionCerts.length === 0 && dumpSync?.ok && dumpSync.inSync && !pm2Error ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            현재 주의가 필요한 항목이 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {unhealthyApps.map(({ app, health, detail }) => (
              <li key={app.id} className="flex items-center gap-2">
                <StatusBadge health={health} />
                <Link href={`/apps/${app.id}`} className="underline underline-offset-2">
                  {app.name}
                </Link>
                <span className="text-black/50 dark:text-white/50">— {detail}</span>
              </li>
            ))}
            {attentionCerts.map((cert) => (
              <li key={cert.file} className="flex items-center gap-2">
                <StatusBadge health={cert.expired ? "down" : "warn"} />
                <Link href="/proxy/certs" className="underline underline-offset-2">
                  {cert.commonName ?? cert.file}
                </Link>
                <span className="text-black/50 dark:text-white/50">
                  — {cert.expired ? "만료됨" : `${cert.daysRemaining}일 후 만료`}
                </span>
              </li>
            ))}
            {dumpSync?.ok && !dumpSync.inSync && (
              <li className="flex items-center gap-2">
                <StatusBadge health="warn" />
                <span>pm2 save 이후 프로세스 목록이 변경되었습니다</span>
                <span className="text-black/50 dark:text-white/50">
                  ({[...dumpSync.onlyInLive, ...dumpSync.onlyInDump].join(", ")})
                </span>
              </li>
            )}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">앱 상태</h2>
          <Link href="/apps" className="text-sm underline underline-offset-2">
            전체 보기
          </Link>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {apps.map(({ app, health, detail }) => (
            <li key={app.id} className="flex items-center justify-between rounded-md border border-black/10 dark:border-white/10 px-3 py-2">
              <Link href={`/apps/${app.id}`} className="underline underline-offset-2">
                {app.name}
              </Link>
              <StatusBadge health={health} detail={detail} />
            </li>
          ))}
          {apps.length === 0 && (
            <li className="text-black/50 dark:text-white/50">
              등록된 앱이 없습니다.{" "}
              <Link href="/apps/new" className="underline underline-offset-2">
                앱 등록하기
              </Link>
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
