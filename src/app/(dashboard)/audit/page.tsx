import { prisma } from "@/lib/db/prisma";

const ACTION_LABEL: Record<string, string> = {
  app_start: "시작",
  app_stop: "중지",
  app_restart: "재시작",
  app_deploy: "배포",
  app_rollback: "롤백",
  proxy_route_change: "프록시 라우트 변경",
  proxy_certs_reload: "인증서 리로드",
  dns_record_change: "DNS 레코드 변경",
};

function formatTimestamp(d: Date) {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export default async function AuditLogPage() {
  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">감사 로그</h1>
        <p className="text-sm text-black/50 dark:text-white/50 mt-1">
          최근 200건 · 재시작/중지/시작/배포/롤백/프록시·DNS 변경 등 제어 작업만 기록됩니다.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
              <th className="py-2 pr-4 font-medium">시각</th>
              <th className="py-2 pr-4 font-medium">관리자</th>
              <th className="py-2 pr-4 font-medium">작업</th>
              <th className="py-2 pr-4 font-medium">대상</th>
              <th className="py-2 pr-4 font-medium">결과</th>
              <th className="py-2 pr-4 font-medium">상세</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2 pr-4 whitespace-nowrap text-black/60 dark:text-white/60">
                  {formatTimestamp(entry.createdAt)}
                </td>
                <td className="py-2 pr-4">{entry.actorEmail}</td>
                <td className="py-2 pr-4">{ACTION_LABEL[entry.action] ?? entry.action}</td>
                <td className="py-2 pr-4">{entry.appName}</td>
                <td className="py-2 pr-4">
                  {entry.success ? (
                    <span className="text-emerald-600 dark:text-emerald-400">성공</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">실패</span>
                  )}
                </td>
                <td className="py-2 pr-4 text-black/50 dark:text-white/50 max-w-xs truncate">
                  {entry.detail ?? "—"}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-black/50 dark:text-white/50">
                  기록된 작업이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
