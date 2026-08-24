import { listDomains, getDkimStatus } from "@/lib/adapters/mailcow";
import { getMailcowContainerHealth } from "@/lib/adapters/mailcowDocker";
import { config } from "@/lib/config";
import { AddDomainForm } from "./AddDomainForm";

const HEALTH_LABEL: Record<string, string> = {
  healthy: "정상",
  unhealthy: "비정상",
  starting: "시작 중",
};

export default async function MailPage() {
  if (!config.MAILCOW_API_URL || !config.MAILCOW_API_KEY) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">메일 서버</h1>
        <div className="rounded-md border border-amber-600/40 p-4 text-sm">
          <p className="text-amber-700 dark:text-amber-400 font-medium">
            mailcow 연동이 설정되어 있지 않습니다.
          </p>
          <p className="mt-1 text-black/60 dark:text-white/60">
            <code>MAILCOW_API_URL</code>, <code>MAILCOW_API_KEY</code>를 설정하면 도메인/DKIM
            현황이, <code>MAILCOW_COMPOSE_DIR</code>을 설정하면 컨테이너 상태가 표시됩니다.
          </p>
        </div>
      </div>
    );
  }

  const [domainsResult, containersResult] = await Promise.all([
    listDomains(),
    getMailcowContainerHealth(),
  ]);

  const domainsWithDkim = domainsResult.ok
    ? await Promise.all(
        domainsResult.data.map(async (d) => ({
          ...d,
          dkim: await getDkimStatus(d.domain),
        })),
      )
    : [];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">메일 서버</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">컨테이너 상태</h2>
        {!containersResult.ok && (
          <p className="text-sm text-red-600 dark:text-red-400">{containersResult.error}</p>
        )}
        {containersResult.ok && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {containersResult.containers.map((c) => {
              const healthy = c.state === "running" && c.health !== "unhealthy";
              return (
                <div
                  key={c.name}
                  className="rounded-md border border-black/10 dark:border-white/10 p-3 text-sm"
                >
                  <p className="font-medium truncate">{c.service}</p>
                  <p className={healthy ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {c.state}
                    {c.health && ` (${HEALTH_LABEL[c.health] ?? c.health})`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">도메인</h2>
        {!domainsResult.ok && (
          <p className="text-sm text-red-600 dark:text-red-400">{domainsResult.error}</p>
        )}
        {domainsResult.ok && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
                  <th className="py-2 pr-4 font-medium">도메인</th>
                  <th className="py-2 pr-4 font-medium">활성</th>
                  <th className="py-2 pr-4 font-medium">메일박스</th>
                  <th className="py-2 pr-4 font-medium">DKIM</th>
                </tr>
              </thead>
              <tbody>
                {domainsWithDkim.map((d) => (
                  <tr key={d.domain} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-2 pr-4 font-mono text-xs">{d.domain}</td>
                    <td className="py-2 pr-4">{d.active === "1" ? "활성" : "비활성"}</td>
                    <td className="py-2 pr-4">{d.mailboxes}</td>
                    <td className="py-2 pr-4">
                      {d.dkim.ok && d.dkim.data.configured ? (
                        <span className="text-emerald-600 dark:text-emerald-400">정상</span>
                      ) : d.dkim.ok ? (
                        <span className="text-amber-600 dark:text-amber-400">미설정</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">{d.dkim.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {domainsWithDkim.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-black/50 dark:text-white/50">
                      등록된 도메인이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <AddDomainForm />
      </section>
    </div>
  );
}
