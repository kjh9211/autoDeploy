"use strict";

// Ops Console 자체를 위한 자동 업데이트 러너 (README "자동 업데이트" 절).
// PM2는 이 파일을 spawn하기만 하고, main 브랜치 fetch/pull/재시작 스케줄링은
// @kjh9211/autoupdate가, 마이그레이션/빌드는 scripts/ensure-built.js가 맡는다.

const path = require("path");
const { App } = require("@kjh9211/autoupdate");
const { ensureBuilt } = require("./scripts/ensure-built");

const ROOT = __dirname;
const PORT = process.env.PORT;

if (!PORT) {
  console.error(
    "[run] PORT 환경변수가 필요합니다. 예: PORT=61001 pm2 start run.js --name ops-console --interpreter node",
  );
  process.exit(1);
}

const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
const ENSURE_BUILT = path.join(ROOT, "scripts", "ensure-built.js");

// 부팅 시점에도 한 번 확인 — 크래시로 재시작됐거나 이 러너 자체가 pm2에 의해
// 재시작된 경우에도 항상 최신 커밋 기준으로 빌드돼 있도록 보장한다.
try {
  ensureBuilt();
} catch (err) {
  console.error(
    "[run] 최초 빌드/마이그레이션 확인 실패 — 기존 .next 빌드가 있으면 일단 그걸로 계속 띄웁니다:",
    err,
  );
}

const app = new App({
  cwd: ROOT,
  branch: "main",
  // ensure-built.js가 자체적으로 "이미 이 커밋으로 빌드됐는지" 확인하므로,
  // 아래 onUpdate가 예정된 재시작 전에 못 끝나도(느린 빌드) 자식 프로세스가
  // 실제로 뜨기 직전에 한 번 더 걸러진다 — 두 겹 안전장치.
  startScript: `${process.execPath} ${ENSURE_BUILT} && ${process.execPath} ${NEXT_BIN} start -p ${PORT}`,
  onUpdate: async (commitMessages, restartAt) => {
    console.log("[run] 업데이트 발견:", commitMessages, "재시작 예정:", restartAt.toISOString());
    try {
      ensureBuilt();
    } catch (err) {
      console.error(
        "[run] 빌드/마이그레이션 실패 — 예정된 재시작 시 startScript의 ensure-built가 다시 시도합니다:",
        err,
      );
    }
  },
});

app.start();
console.log(`[run] ops-console 자동 업데이트 러너 시작 (branch=main, port=${PORT})`);
