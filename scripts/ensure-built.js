"use strict";

// git 커밋 SHA 기준으로 "이 코드가 이미 빌드됐는지"를 확인하고, 아니면
// migrate deploy → generate → build를 순서대로 실행한다. run.js의 onUpdate
// 콜백(빠른 경로)과 자식 프로세스의 startScript(안전망) 양쪽에서 이 함수를
// 호출한다 — onUpdate가 재시작 시각 전에 못 끝나도(느린 빌드) 자식이
// 실제로 뜨기 직전에 한 번 더 걸러지도록 하기 위해서다.
//
// npm/npx/prisma 등 .cmd 래퍼를 거치면 Windows에서 pm2/spawn과 얽혀 문제가
// 생긴 전례가 있어(README "프로덕션 배포" 절 참고), 항상 실제 .js 엔트리를
// node로 직접 실행한다.

const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const MARKER = path.join(ROOT, ".next", "OPS_CONSOLE_BUILT_SHA");
const PRISMA_BIN = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");

function currentSha() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
}

function builtSha() {
  try {
    return fs.readFileSync(MARKER, "utf8").trim();
  } catch {
    return null;
  }
}

function run(args) {
  execFileSync(process.execPath, args, { cwd: ROOT, stdio: "inherit" });
}

function ensureBuilt() {
  const sha = currentSha();
  if (builtSha() === sha) {
    console.log(`[ensure-built] 이미 ${sha}로 빌드됨 — 스킵`);
    return;
  }
  console.log(`[ensure-built] 빌드 시작: ${sha}`);
  run([PRISMA_BIN, "migrate", "deploy"]);
  run([PRISMA_BIN, "generate"]);
  run([NEXT_BIN, "build"]);
  fs.mkdirSync(path.dirname(MARKER), { recursive: true });
  fs.writeFileSync(MARKER, sha);
  console.log(`[ensure-built] 빌드 완료: ${sha}`);
}

module.exports = { ensureBuilt };

if (require.main === module) {
  ensureBuilt();
}
