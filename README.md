# autoDepoly — Ops Console

Windows 서버(PM2 · 리버스 프록시 · Cloudflare · MySQL · mailcow · 마인크래프트 NSSM)의 배포 구조를 한 화면에서 조회·통제하는 관리자 콘솔.

- 기획서: [`docs/PLANNING.md`](docs/PLANNING.md)
- 현재 구현 범위: **Phase 0~4 전체** (docs/PLANNING.md §9) — 기획서의 모든 단계가 구현되어 있음
  - Phase 0: 앱 레지스트리, 로그인+2FA, PM2/NSSM 상태·인증서 만료일·git 로컬/원격 diff를 보여주는 읽기 전용 대시보드
  - Phase 1: 앱 시작/중지/재시작, PM2 로그 실시간 스트리밍(NSSM은 로그 파일 경로를 등록하면 동일하게 지원), 모든 제어 작업의 감사 로그(`/audit`)
  - Phase 2: 배포 파이프라인 자동화 — "배포 실행" 한 번으로 fetch → 병합 → (필요시) install/마이그레이션/빌드/슬래시커맨드 배포 → 재시작 → 헬스체크 → `pm2 save`까지 실행, 단계별 실시간 로그(`/deploys/[id]`), 배포 이력(`/deploys`), 이전 배포 시점으로 롤백
  - Phase 3: 리버스 프록시 라우팅 관리(`/proxy`) + 인증서 리로드 + Cloudflare DNS 조회/편집(`/dns`, 오리진 IP 불일치·`mail.*` orange-cloud 오류 강조). **webproxy 쪽 연동은 별도 적용이 필요** — 아래 "webproxy 연동" 절 참고. Cloudflare 연동은 실제 토큰 없이 구현해 목 서버로만 검증했으니 실제 토큰으로 한 번 더 확인할 것
  - Phase 4: mailcow 연동(`/mail` — 도메인/DKIM 현황, `docker compose ps` 기반 컨테이너 헬스, 도메인 추가 시 mailcow 자체 DKIM 생성) + 신규 앱 온보딩(앱 등록과 동시에 webproxy 라우팅·Cloudflare DNS 생성, `/apps/new`). mailcow API도 실제 계정 없이 목 서버로만 검증 — 실제 인스턴스로 재확인 권장. 컨테이너 헬스 조회는 실제 `docker compose`로 검증 완료

각 Phase에서 실제로 이 저장소 밖의 것(webproxy, Cloudflare, mailcow)에 의존하는 기능은 전부 "설정 안 하면 안내만 표시, 다른 기능엔 영향 없음"으로 동작한다 — 아래 환경 변수를 하나도 안 채워도 Phase 0~2 기능은 그대로 쓸 수 있다.

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

### 코드를 새로 받았을 때 (git pull 이후)

`src/generated/prisma`(생성된 Prisma Client)는 git에 커밋되지 않는다. 스키마를 바꾸는 커밋을 받은 뒤 재생성 없이 그대로 서버를 재시작하면 새로 추가된 모델에 대해 `prisma.xxx`가 `undefined`가 되어 `Cannot read properties of undefined (reading 'findMany')` 같은 오류가 난다. `git pull` 후에는 항상:

```bash
npx prisma migrate deploy
npx prisma generate
```

를 실행하고 나서 앱을 재시작할 것 (`npm run dev` 또는 `pm2 restart ops-console`).

### 환경 변수

| 변수 | 설명 |
|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:3306/ops_console` |
| `SESSION_SECRET` | 세션 쿠키 서명 키. `openssl rand -hex 32`로 생성 |
| `CERTS_DIR` | webproxy가 `addContext()`로 로드하는 것과 같은 인증서 폴더 (예: `E:\webproxy\certs`) |
| `DUMP_PM2_PATH` | `pm2 save`가 쓰는 `dump.pm2` 경로 |
| `WEBPROXY_ADMIN_URL` / `WEBPROXY_ADMIN_TOKEN` | (선택) webproxy 내부 관리 API. 아래 "webproxy 연동" 참고 — 없어도 `/proxy`는 안내만 표시하고 나머지 기능엔 영향 없음 |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONES` / `ORIGIN_IP` | (선택) Cloudflare DNS 연동. `CLOUDFLARE_ZONES`는 콤마로 구분한 존 이름 목록 (예: `kjh9211.kr,noahsoft.kr`). 없어도 `/dns`는 안내만 표시 |
| `MAILCOW_API_URL` / `MAILCOW_API_KEY` / `MAILCOW_COMPOSE_DIR` | (선택) mailcow 연동. API URL/키는 mailcow 자체 REST API용, COMPOSE_DIR은 컨테이너 헬스 조회(`docker compose ps`)용 mailcow docker-compose 프로젝트 경로. 없어도 `/mail`은 안내만 표시 |

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

### 배포 파이프라인 설정

앱 등록/수정 화면의 "배포 설정" 항목(빌드 명령, DB 마이그레이션 명령, 슬래시 커맨드 배포 명령, 헬스체크 URL)은 로그인한 관리자가 직접 입력하는 값이며, 그대로 셸에서 실행된다. 요청으로 들어오는 값이 아니라 이미 관리자가 손으로 직접 실행하던 것과 동일한 명령을 한 번 등록해두는 것뿐이므로, docs/PLANNING.md §7의 "임의 명령 실행 콘솔 금지" 원칙과 배치되지 않는다 — 다만 앱 등록 폼 자체를 신뢰되지 않은 사람에게 열어주면 안 된다는 뜻이기도 하다.

배포 파이프라인은 앱마다 최대 하나만 동시에 실행되도록 막혀 있고(이미 진행 중이면 새로 시작 거부), 로컬에 커밋되지 않은 변경이 있으면 관리자가 "무시하고 진행"을 직접 선택하지 않는 한 자동으로 멈춘다.

### webproxy 연동

`E:\webproxy`는 이 저장소 밖의 별도 코드베이스라, `/proxy`(라우팅 관리)와 `/proxy/certs`의 "webproxy에 반영" 버튼이 실제로 동작하려면 webproxy 쪽에 내부 관리 API를 먼저 구현해야 한다 — **참고 구현과 정확한 계약은 [`docs/webproxy-integration.md`](docs/webproxy-integration.md)에 문서화**해뒀다. 적용 전에는 두 화면이 연결 실패 안내만 보여줄 뿐 나머지 기능(앱 관리, 배포, DNS 등)에는 아무 영향이 없다.

### DNS 확인 규칙

`/dns`는 두 가지만 자동으로 강조한다: (1) A레코드 값이 `ORIGIN_IP`와 다른 경우, (2) `mail.`로 시작하는 레코드인데 orange-cloud(proxied)인 경우. 그 외의 경우는 경고를 띄우지 않는다 — 의도적으로 grey-cloud를 쓰는 레코드가 있을 수 있어서다.

### mailcow 연동

`/mail`은 두 가지 서로 다른 소스를 합쳐서 보여준다: 도메인/메일박스/DKIM 현황은 mailcow 자체 REST API(`MAILCOW_API_URL`/`MAILCOW_API_KEY`)로, 컨테이너 헬스는 mailcow가 Docker(docker-compose)로 떠 있다는 전제 하에 `MAILCOW_COMPOSE_DIR`에서 `docker compose ps --all --format json`을 직접 실행해서 얻는다 — mailcow API에는 컨테이너 단위 헬스 엔드포인트가 없어서다. 도메인 추가 시 DKIM 값은 이 콘솔이 직접 만들지 않고, 항상 mailcow가 `/api/v1/add/dkim` 호출로 스스로 생성한 값만 그대로 읽어 보여준다. mailcow API는 실제 계정 없이 목 서버로만 검증했으니(docs/PLANNING.md §9), 실제 인스턴스에 붙이기 전에 도메인 추가 흐름을 한 번 확인할 것.

### 신규 앱 온보딩

`/apps/new`에서 앱을 등록할 때 "webproxy 라우팅 자동 생성"과 "Cloudflare DNS 레코드 자동 생성" 체크박스를 켜면, 앱 등록과 동시에 webproxy 라우팅(Phase 3 API)과 Cloudflare A레코드(Phase 3 API)를 이어서 시도한다. 앱 등록 자체는 항상 성공하며, 이후 인프라 단계가 실패해도 앱 row를 롤백하지 않고 "best-effort"로 동작한다 — 실패한 항목은 앱 상세 페이지 상단에 경고 배너로 표시되고, 감사 로그(`/audit`, `onboard_app`)에도 성공/실패 여부와 상세 사유가 남는다.

### PM2에서 앱 가져오기

`/apps/new/from-pm2`는 이미 PM2로 떠 있지만 아직 등록되지 않은 프로세스(등록된 앱의 `pm2Name`과 겹치지 않는 것)를 `pm2 list`로 조회해 목록으로 보여준다. "이 프로세스 등록" 버튼 한 번이면 이름·PM2 프로세스명·로컬 경로(PM2의 작업 디렉터리)가 PM2에서 읽은 값 그대로 채워진 앱 row가 만들어지고, 곧바로 그 앱의 상세 페이지로 이동한다 — 도메인·배포 명령 등 나머지 항목은 거기서 채우면 된다. PM2 프로세스 이름과 같은 이름의 앱이 이미 있으면(이름 중복) 등록을 거부하고 오류를 보여준다. `.cmd` 등 비표준 방식으로 실행 중인 프로세스는(docs/PLANNING.md §6.1) 목록에 경고로 표시된다.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드/실행 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npx prisma db seed` | 관리자 계정 생성 (최초 1회) |
