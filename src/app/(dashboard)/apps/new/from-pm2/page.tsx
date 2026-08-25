import Link from "next/link";
import { listPm2Processes } from "@/lib/adapters/pm2";
import { prisma } from "@/lib/db/prisma";
import { createAppFromPm2 } from "../actions";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";

const STATUS_LABEL: Record<string, string> = {
  online: "실행 중",
  stopping: "중지 중",
  stopped: "중지됨",
  launching: "시작 중",
  errored: "오류",
  "one-launch-status": "일회성 실행",
  waiting_restart: "재시작 대기",
  unknown: "알 수 없음",
};

export default async function FromPm2Page(props: PageProps<"/apps/new/from-pm2">) {
  const searchParams = await props.searchParams;
  const error = typeof searchParams.error === "string" ? searchParams.error : null;

  const [pm2Result, registeredApps] = await Promise.all([
    listPm2Processes(),
    prisma.app.findMany({ select: { pm2Name: true } }),
  ]);

  const header = (
    <div>
      <h1 className="text-xl font-semibold">PM2에서 앱 가져오기</h1>
      <p className="text-sm text-black/50 dark:text-white/50 mt-1">
        이미 PM2로 떠 있지만 아직 등록되지 않은 프로세스 목록입니다. 등록하면 이름·PM2 프로세스명·로컬
        경로가 PM2에서 읽은 값 그대로 채워지고, 도메인·배포 명령 등 나머지 항목은 등록 직후 이동하는 앱
        상세 페이지에서 채우면 됩니다.
      </p>
    </div>
  );

  if (!pm2Result.ok) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <p className="text-sm text-red-600 dark:text-red-400">
          PM2에 연결할 수 없습니다: {pm2Result.error}
        </p>
        <Link href="/apps/new" className="text-sm underline underline-offset-2 w-fit">
          수동으로 등록하기
        </Link>
      </div>
    );
  }

  const registeredNames = new Set(
    registeredApps.map((a) => a.pm2Name).filter((name): name is string => !!name),
  );
  const candidates = pm2Result.processes.filter((p) => !registeredNames.has(p.name));

  return (
    <div className="flex flex-col gap-6">
      {header}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {candidates.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          등록되지 않은 PM2 프로세스가 없습니다 — 이미 전부 등록되어 있거나, PM2에 떠 있는 프로세스가
          없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {candidates.map((p) => (
            <li
              key={p.name}
              className="flex items-center justify-between gap-4 rounded-md border border-black/10 dark:border-white/10 p-3"
            >
              <div className="flex flex-col gap-1 text-sm min-w-0">
                <span className="font-medium">{p.name}</span>
                <span className="text-black/50 dark:text-white/50">
                  {STATUS_LABEL[p.status] ?? p.status}
                  {p.cwd ? ` · ${p.cwd}` : ""}
                </span>
                {!p.followsWindowsConvention && (
                  <span className="text-amber-600 dark:text-amber-400">
                    .cmd 등 비표준 방식으로 실행 중 — 등록 후 재시작/배포 동작을 확인해 볼 것
                    (docs/PLANNING.md §6.1)
                  </span>
                )}
              </div>
              <form action={createAppFromPm2}>
                <SubmitLoadingOverlay label="등록하는 중입니다…" />
                <input type="hidden" name="pm2Name" value={p.name} />
                <input type="hidden" name="cwd" value={p.cwd ?? ""} />
                <button
                  type="submit"
                  className="shrink-0 rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium"
                >
                  이 프로세스 등록
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <Link href="/apps/new" className="text-sm underline underline-offset-2 w-fit">
        수동으로 등록하기
      </Link>
    </div>
  );
}
