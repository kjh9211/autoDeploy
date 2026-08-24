import Link from "next/link";
import { listWebproxyRoutes } from "@/lib/adapters/webproxy";
import { RoutesPageClient } from "./RoutesPageClient";

export default async function ProxyPage() {
  const result = await listWebproxyRoutes();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">리버스 프록시 라우팅</h1>
          <p className="text-sm text-black/50 dark:text-white/50 mt-1">webproxy가 관리</p>
        </div>
        <Link href="/proxy/certs" className="text-sm underline underline-offset-2">
          인증서 현황
        </Link>
      </div>

      {!result.ok && (
        <div className="rounded-md border border-amber-600/40 p-4 text-sm">
          <p className="text-amber-700 dark:text-amber-400 font-medium">
            webproxy 관리 API에 연결할 수 없습니다.
          </p>
          <p className="mt-1 text-black/60 dark:text-white/60">{result.error}</p>
          <p className="mt-2 text-black/60 dark:text-white/60">
            webproxy 쪽에 이 기능을 구현하는 방법은{" "}
            <code>docs/webproxy-integration.md</code>를 참고하세요. 아직 연동 전이라도 이
            페이지 밖의 다른 기능에는 영향이 없습니다.
          </p>
        </div>
      )}

      {result.ok && <RoutesPageClient routes={result.data.routes} />}
    </div>
  );
}
