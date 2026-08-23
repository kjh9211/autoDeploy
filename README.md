# autoDepoly — Ops Console

Windows 서버(PM2 · 리버스 프록시 · Cloudflare · MySQL · mailcow · 마인크래프트 NSSM)의 배포 구조를 한 화면에서 조회·통제하는 관리자 콘솔.

- 기획서: [`docs/PLANNING.md`](docs/PLANNING.md)
- 현재 구현 범위: **Phase 0 + Phase 1** (docs/PLANNING.md §9)
  - Phase 0: 앱 레지스트리, 로그인+2FA, PM2/NSSM 상태·인증서 만료일·git 로컬/원격 diff를 보여주는 읽기 전용 대시보드
  - Phase 1: 앱 시작/중지/재시작, PM2 로그 실시간 스트리밍(NSSM은 로그 파일 경로를 등록하면 동일하게 지원), 모든 제어 작업의 감사 로그(`/audit`)
  - 배포 자동화·리버스 프록시/DNS 편집·mailcow 연동은 이후 단계(Phase 2~4)

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

### 마인크래프트(NSSM) 서비스 제어 권한 설정

Windows 서비스의 시작/중지는 기본적으로 관리자 권한이 필요하다. Ops Console을 관리자 권한으로 띄우고 싶지 않다면(docs/PLANNING.md §6.7의 결정), 대상 서비스(Velocity, Paper 등)에 한해 Ops Console을 구동하는 OS 계정에게만 시작/중지/조회 권한을 ACL로 부여한다 — **한 번만** 하면 된다.

```powershell
# 1) Ops Console을 실행하는 계정의 SID 확인
$sid = (New-Object System.Security.Principal.NTAccount("<ops-console 계정명>")).Translate([System.Security.Principal.SecurityIdentifier]).Value

# 2) 대상 서비스의 현재 보안 설명자 확인 (백업 겸)
sc.exe sdshow <서비스이름>

# 3) 위 출력의 DACL(D:(...)... 부분) 안에 아래 ACE를 하나 추가해서 sdset으로 적용
#    RP=시작 WP=중지 LC=상태조회 RC=읽기 권한
sc.exe sdset <서비스이름> "D:(A;;RPWPLCRC;;;$sid)<...기존 DACL 나머지...>(A;;CCLCSWLOCRRC;;;IU)(A;;CCLCSWLOCRRC;;;SU)(A;;CCLCSWRPWPDTLOCRRC;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)S:(AU;FA;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;WD)"
```

정확한 3단계 문자열은 서버마다 `sdshow`로 나온 기존 DACL 그대로 유지한 채 우리 SID의 ACE만 추가해야 한다 — 절대 그대로 복붙하지 말고, 2단계에서 얻은 원본 문자열에 `(A;;RPWPLCRC;;;$sid)`만 삽입해서 3단계에 사용할 것. 이 권한이 없으면 앱은 그대로 켜져 있고, 대시보드에서 재시작/중지를 누르면 "액세스가 거부되었습니다" 오류만 뜬다(크래시 없음).

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드/실행 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npx prisma db seed` | 관리자 계정 생성 (최초 1회) |
