import { NextResponse } from "next/server";

// Dependency-free liveness probe — no DB, no PM2/NSSM/git/외부 API 호출.
// 페이지가 느릴 때 Next.js 프로세스/네트워크 구간 자체가 느린 건지, 아니면
// 그 페이지가 부르는 라이브 외부 조회가 느린 건지 구분하는 용도이므로
// 여기엔 앞으로도 무거운 로직을 추가하지 않는다.
export async function GET() {
  return NextResponse.json({
    ok: true,
    now: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
  });
}
