import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

const MODE_LABEL: Record<string, string> = {
  update: "업데이트",
  rollback: "롤백",
};

function formatTimestamp(d: Date) {
  return d.toISOString().replace("T", " ").slice(0, 19);
}

export default async function DeploysPage() {
  const deploys = await prisma.deployLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">배포 이력</h1>
        <p className="text-sm text-black/50 dark:text-white/50 mt-1">최근 100건</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
              <th className="py-2 pr-4 font-medium">시작 시각</th>
              <th className="py-2 pr-4 font-medium">앱</th>
              <th className="py-2 pr-4 font-medium">종류</th>
              <th className="py-2 pr-4 font-medium">커밋</th>
              <th className="py-2 pr-4 font-medium">실행자</th>
              <th className="py-2 pr-4 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {deploys.map((d) => (
              <tr key={d.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2 pr-4 whitespace-nowrap text-black/60 dark:text-white/60">
                  {formatTimestamp(d.startedAt)}
                </td>
                <td className="py-2 pr-4">
                  <Link href={`/deploys/${d.id}`} className="underline underline-offset-2">
                    {d.appName}
                  </Link>
                </td>
                <td className="py-2 pr-4">{MODE_LABEL[d.mode] ?? d.mode}</td>
                <td className="py-2 pr-4 font-mono text-xs">
                  {d.fromCommit?.slice(0, 7) ?? "?"} → {d.toCommit?.slice(0, 7) ?? "?"}
                </td>
                <td className="py-2 pr-4">{d.triggeredBy}</td>
                <td className="py-2 pr-4">
                  {d.status === "running" && (
                    <span className="text-amber-600 dark:text-amber-400">진행 중</span>
                  )}
                  {d.status === "success" && (
                    <span className="text-emerald-600 dark:text-emerald-400">성공</span>
                  )}
                  {d.status === "failed" && (
                    <span className="text-red-600 dark:text-red-400">실패</span>
                  )}
                </td>
              </tr>
            ))}
            {deploys.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-black/50 dark:text-white/50">
                  아직 배포 이력이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
