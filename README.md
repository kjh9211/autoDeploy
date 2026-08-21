# autoDepoly — Ops Console

Windows 서버(PM2 · 리버스 프록시 · Cloudflare · MySQL · mailcow · 마인크래프트 NSSM)의 배포 구조를 한 화면에서 조회·통제하는 관리자 콘솔.

- 기획서: [`docs/PLANNING.md`](docs/PLANNING.md)
- 현재 구현 범위: **Phase 0** (docs/PLANNING.md §9) — 앱 레지스트리, 로그인+2FA, PM2/NSSM 상태·인증서 만료일·git 로컬/원격 diff를 보여주는 읽기 전용 대시보드. 재시작/배포/DNS 편집 등 제어 기능은 이후 단계.

## 요구사항

- Node.js 20.9+
- MySQL 8.0 (또는 MariaDB) — 기존 공유 인스턴스에 `ops_console` 스키마 하나를 추가해서 씀
- Windows 서버에서 실제로 돌릴 때: PM2, (마인크래프트 서비스 조회용) PowerShell

## 로컬 설정

```bash
npm install
cp .env.example .env   # 값 채우기 (아래 표 참고)

npx prisma migrate deploy   # 최초 1회: 스키마 적용 (개발 중 스키마를 바꿀 땐 migrate dev)
npx prisma generate

# 최초 관리자 계정 생성 — 콘솔에 TOTP 프로비저닝 URI가 한 번만 출력됨,
# 바로 인증 앱에 등록할 것
OPS_ADMIN_EMAIL=you@example.com OPS_ADMIN_PASSWORD='최소 12자' npx prisma db seed

npm run dev   # http://localhost:3000
```

### 환경 변수

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:3306/ops_console` |
| `SESSION_SECRET` | 세션 쿠키 서명 키. `openssl rand -hex 32`로 생성 |
| `CERTS_DIR` | webproxy가 `addContext()`로 로드하는 것과 같은 인증서 폴더 (예: `E:\webproxy\certs`) |
| `DUMP_PM2_PATH` | `pm2 save`가 쓰는 `dump.pm2` 경로 |

## 프로덕션 배포 (Windows, PM2)

기존 배포 워크플로우(docs/PLANNING.md §1)와 동일하게, `.cmd` 배치파일이 아니라 `node_modules/.bin`의 실제 `.js` 엔트리를 `--interpreter node`로 띄운다.

```powershell
npm run build
pm2 start node_modules/next/dist/bin/next --name ops-console --interpreter node -- start -p <port>
pm2 save
```

webproxy에 `ops.<domain>` 같은 서브도메인 라우팅을 추가해 이 포트로 연결하면 된다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드/실행 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npx prisma db seed` | 관리자 계정 생성 (최초 1회) |
