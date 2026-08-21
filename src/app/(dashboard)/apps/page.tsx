import Link from "next/link";
import { getAppsWithStatus } from "@/lib/appStatus";
import { StatusBadge } from "@/components/StatusBadge";

const TYPE_LABEL: Record<string, string> = {
  node_app: "Node 앱",
  static_web: "정적 웹앱",
  discord_bot: "Discord 봇",
  minecraft: "마인크래프트",
};

export default async function AppsPage() {
  const { apps, pm2Error } = await getAppsWithStatus();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">앱</h1>
        <Link
          href="/apps/new"
          className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium"
        >
          새 앱 등록
        </Link>
      </div>

      {pm2Error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          PM2 조회 실패: {pm2Error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
              <th className="py-2 pr-4 font-medium">이름</th>
              <th className="py-2 pr-4 font-medium">유형</th>
              <th className="py-2 pr-4 font-medium">런타임</th>
              <th className="py-2 pr-4 font-medium">도메인</th>
              <th className="py-2 pr-4 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {apps.map(({ app, health, detail }) => (
              <tr key={app.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2 pr-4">
                  <Link href={`/apps/${app.id}`} className="underline underline-offset-2">
                    {app.name}
                  </Link>
                </td>
                <td className="py-2 pr-4">{TYPE_LABEL[app.type] ?? app.type}</td>
                <td className="py-2 pr-4">{app.runtime}</td>
                <td className="py-2 pr-4">{app.domain ?? "—"}</td>
                <td className="py-2 pr-4">
                  <StatusBadge health={health} detail={detail} />
                </td>
              </tr>
            ))}
            {apps.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-black/50 dark:text-white/50">
                  등록된 앱이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
