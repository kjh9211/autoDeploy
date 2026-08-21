import { listCerts } from "@/lib/adapters/certs";
import { config } from "@/lib/config";

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function CertsPage() {
  const result = await listCerts(config.CERTS_DIR);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">인증서 현황</h1>
        <p className="text-sm text-black/50 dark:text-white/50 mt-1">
          {config.CERTS_DIR} — 만료일이 가까운 순
        </p>
      </div>

      {!result.ok && (
        <p className="text-sm text-red-600 dark:text-red-400">
          인증서 디렉터리를 읽을 수 없습니다: {result.error}
        </p>
      )}

      {result.ok && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
                <th className="py-2 pr-4 font-medium">도메인</th>
                <th className="py-2 pr-4 font-medium">발급자</th>
                <th className="py-2 pr-4 font-medium">만료일</th>
                <th className="py-2 pr-4 font-medium">상태</th>
                <th className="py-2 pr-4 font-medium">파일</th>
              </tr>
            </thead>
            <tbody>
              {result.certs.map((cert) => (
                <tr key={cert.file} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-4">
                    {cert.commonName ?? cert.dnsNames[0] ?? "—"}
                    {cert.dnsNames.length > 1 && (
                      <span className="text-black/50 dark:text-white/50">
                        {" "}
                        (+{cert.dnsNames.length - 1})
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">{cert.issuer ?? "—"}</td>
                  <td className="py-2 pr-4">{formatDate(cert.notAfter)}</td>
                  <td className="py-2 pr-4">
                    {cert.expired ? (
                      <span className="text-red-600 dark:text-red-400">만료됨</span>
                    ) : cert.expiringSoon ? (
                      <span className="text-amber-600 dark:text-amber-400">
                        {cert.daysRemaining}일 후 만료
                      </span>
                    ) : (
                      <span className="text-black/60 dark:text-white/60">
                        {cert.daysRemaining}일 남음
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-black/50 dark:text-white/50">
                    {cert.file}
                  </td>
                </tr>
              ))}
              {result.certs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-black/50 dark:text-white/50">
                    인증서 파일이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
