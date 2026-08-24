# 홈서버 운영 콘솔 기획서 (가칭: Ops Console)

> 대상 인프라: Windows 서버 1대에서 PM2 / 리버스 프록시(webproxy) / Cloudflare / MySQL / mailcow(Docker) / 마인크래프트(NSSM)를 함께 운영하는 현재 배포 구조
> 목적: 위 구조를 한 화면에서 조회·통제할 수 있는 관리자 전용 웹 대시보드 기획

---

## 0. 배경과 문제의식

현재 배포 구조는 잘 정리되어 있지만, 상태를 파악하려면 여러 도구를 오가야 한다.

| 확인하고 싶은 것 | 지금 하는 방법 |
|---|---|
| 앱이 살아있나 | `pm2 list` / `pm2 logs` |
| 새 커밋이 있나 | 앱 폴더마다 `git fetch` + 직접 diff 확인 |
| 프록시 라우팅이 뭐로 되어있나 | `E:\webproxy`의 `router` 객체 코드를 직접 열어봄 |
| 인증서 언제 만료되나 | `certs/` 폴더 파일을 직접 확인하거나 브라우저에서 확인 |
| DNS가 오리진 IP를 제대로 가리키나 | Cloudflare 대시보드 로그인 |
| 마인크래프트 서버가 떠있나 | `services.msc` / `nssm status` |
| 메일 도메인 DKIM이 정상인가 | mailcow 관리자 UI 로그인 |

→ **하나의 웹 대시보드**에서 "지금 뭐가 어떻게 떠있고, 뭐가 문제인지"를 한눈에 보고, 반복적인 배포/재시작 작업을 버튼 클릭으로 줄이는 것이 이 프로젝트의 목표다.

이 도구는 오케스트레이션 엔진이 아니라 **제어판(control panel)** 이다. 각 앱·프록시·서비스는 이 도구 없이도 지금처럼 독립적으로 동작해야 하며, 이 도구가 죽어도 서비스에는 영향이 없어야 한다.

---

## 1. 목표 / 비목표

**목표**
- 7개 영역(PM2, 리버스 프록시, DNS/TLS, 배포 워크플로우, DB, 메일서버, 마인크래프트)의 상태를 한 화면에서 조회
- 반복 작업(재시작, 업데이트 확인 → 배포, 로그 확인)을 웹 UI 액션으로 축소
- 위험한 작업(재시작, DNS 변경, 서비스 중지)에 대한 감사 로그와 확인 절차 확보
- 신규 앱을 붙일 때 "PM2 등록 + 프록시 라우팅 + DNS 레코드 + 인증서"를 한 흐름으로 안내

**비목표 (이번 범위에서 제외)**
- CI/CD 완전 자동화(웹훅 기반 자동 배포)는 다루지 않음 — 항상 관리자가 버튼을 눌러 트리거
- 임의 셸 명령 실행 콘솔은 만들지 않음 (보안 리스크 대비 이득이 적음)
- mailcow/webproxy 자체의 재구현이 아니라 "기존 것을 감싸는 관리 계층"
- 다중 서버/다중 관리자 대응은 1인 운영을 기준으로 후순위

---

## 2. 전체 아키텍처

```
                         ┌─────────────────────────────┐
 사용자(관리자) ───HTTPS──▶│   webproxy (기존, 443/80)     │
                         │  Host 헤더 → 127.0.0.1:PORT  │
                         └───────────────┬──────────────┘
                                         │ ops.<domain> 라우팅
                                         ▼
                         ┌─────────────────────────────┐
                         │   Ops Console (신규, PM2 관리) │
                         │   Next.js app, 127.0.0.1:PORT│
                         │                              │
                         │  ┌────────────────────────┐  │
                         │  │ 웹 UI (대시보드/제어)     │  │
                         │  └───────────┬────────────┘  │
                         │              ▼                │
                         │  ┌────────────────────────┐  │
                         │  │ 서버 사이드 어댑터 계층    │  │
                         │  └────────────────────────┘  │
                         └───┬───┬───┬───┬───┬───┬──────┘
                             │   │   │   │   │   │
        ┌────────────────────┘   │   │   │   │   └───────────────────┐
        ▼                        ▼   ▼   ▼   ▼                       ▼
   PM2 데몬(로컬 API)   webproxy 라우트 파일  Cloudflare API   mailcow API   MySQL(로컬)
   nssm/sc.exe(PowerShell)   certs/ 폴더 파싱   git(simple-git)   Docker(mailcow 스택)
```

- Ops Console 자신도 **똑같이 PM2로 관리**되는 Next.js 앱이며, webproxy 뒤의 서브도메인(예: `ops.kjh9211.kr`) 하나를 그대로 사용한다 — 기존 방식에서 벗어나지 않는다.
- 외부 시스템과의 통신은 전부 **서버 사이드**에서만 일어나고, 브라우저는 Ops Console API만 호출한다. (Cloudflare/mailcow 토큰이 클라이언트에 노출되지 않음)
- "어댑터 계층"은 아래 §6에서 시스템별로 상세 설계.

---

## 3. 정보 구조 (IA) / 화면 설계

```
/login                       로그인 (ID/PW + TOTP)
/                             대시보드 (전체 요약)
/apps                         앱 레지스트리 목록
/apps/[id]                    앱 상세 (PM2 상태 · 로그 · 배포 이력 · 도메인 · DB)
/apps/new                     신규 앱 온보딩 마법사
/proxy                        리버스 프록시 라우팅 테이블 관리
/proxy/certs                  인증서 현황 (만료일 정렬)
/dns                          Cloudflare DNS 레코드 뷰 + 편집
/deploys                      전체 배포 이력 (앱 무관 타임라인)
/database                     MySQL 스키마 현황
/mail                         mailcow 도메인/DKIM/컨테이너 상태
/minecraft                    NSSM 서비스(Velocity/Paper) 상태
/audit                        감사 로그
/settings                     사용자/권한, 알림(Discord 웹훅), API 토큰 관리
```

### 3.1 대시보드 (`/`)
- 상단 요약 카드: 전체 앱 수 / 정상·비정상 / 오늘 배포 건수 / 만료 임박 인증서 수 / DNS 이상 레코드 수
- "주의 필요" 리스트 (상태 비정상, 인증서 14일 이내 만료, `dump.pm2`와 현재 프로세스 목록 불일치, 원격 저장소에 새 커밋 존재 등)를 우선순위 정렬로 노출
- 최근 활동 타임라인 (배포, 재시작, 설정 변경)

### 3.2 앱 상세 (`/apps/[id]`)
탭 구성: **개요 / 로그(실시간 tail) / 배포 / 도메인·프록시 / 데이터베이스**
- 개요: PM2 상태(status, cpu, mem, uptime, restart 횟수), 실행 방식(`--interpreter node` 여부, 실제 엔트리 경로) 표시
- 배포 탭: "업데이트 확인" 버튼 → `git fetch` + diff 요약(커밋 수, `package.json`/`schema.sql` 변경 여부) → "배포 실행" 버튼으로 파이프라인 트리거, 진행 상황 실시간 스트리밍, 완료 후 헬스체크 결과

### 3.3 신규 앱 온보딩 마법사 (`/apps/new`)
현재 수동으로 하는 "PM2 등록 → webproxy 라우팅 추가 → Cloudflare DNS 추가 → 인증서 확인" 흐름을 한 폼으로:
1. 기본 정보 (이름, 타입: node-app/static-web/discord-bot/minecraft, 저장소 URL, 배포 브랜치)
2. 실행 정보 (포트, 프레임워크 선택[Next.js/Vite/커스텀 Node] → 선택에 따라 `next start -p {port}` / `vite preview --port {port} --host` / `--interpreter node <엔트리>` 형태로 `start_cmd` 자동 생성 및 수정 가능, 또는 NSSM 서비스명, 빌드/마이그레이션 명령, 슬래시 커맨드 경로가 있으면 `commands_path`)
3. 도메인 정보 (서브도메인, 대상 존, orange/grey cloud 여부, Host 헤더 유지 필요 여부 체크박스) → DNS 레코드 미리보기 후 생성
4. 요약 확인 → 생성 (PM2 ecosystem 항목 생성 + webproxy 라우트 파일 반영 + Cloudflare A레코드 생성)

### 3.4 프록시 라우팅 관리 (`/proxy`)
- 테이블: Host 헤더 → 대상 포트, 유형(프록시 / 302 리다이렉트 / Host 헤더 유지 특수케이스), 담당 앱
- 신규/수정/삭제는 코드 직접 수정이 아니라 **라우트 설정 파일(JSON)** 을 통해 이루어지고, webproxy가 이를 자동 리로드 (§6.2)
- "설정 검증 후 적용" 원칙 — 문법 오류나 포트 중복 시 적용 거부, 실패 시 이전 설정 유지

### 3.5 인증서 현황 (`/proxy/certs`)
- 도메인별 발급자(Cloudflare Origin CA / Let's Encrypt), 만료일, 남은 일수 정렬
- `mail.kjh9211.kr`은 Let's Encrypt(90일 주기)이므로 별도 배지로 강조, 갱신 스크립트 마지막 실행 시각 표시

### 3.6 DNS 관리 (`/dns`)
- Cloudflare 존별(kjh9211.kr, noahsoft.kr) 레코드 목록, 프록시 상태(orange/grey) 표시
- 오리진 IP(`49.174.34.38`)와 다른 A레코드는 이상 항목으로 강조
- `mail.*`류 grey-cloud 필요 레코드가 orange로 되어 있으면 경고

### 3.7 데이터베이스 (`/database`)
- 공유 MySQL의 스키마 목록(예: `security_bot`, `discord_perm_manager`), 크기, 마지막 백업 시각
- 스키마별 "지금 백업 실행" 버튼 (§4의 백업 트리거 기능에 대응 — `mysqldump` 즉시 실행, 완료 시 마지막 백업 시각 갱신)
- mailcow의 내부 MySQL은 관리 범위 밖임을 명시하고 mailcow 관리자 UI 링크만 제공
- 쓰기 콘솔은 제공하지 않고, 읽기 전용 계정으로 메타데이터만 조회

### 3.8 메일 서버 (`/mail`)
- mailcow API 연동: 도메인 목록, DKIM 상태(정상/미설정), 메일박스 수/쿼터
- 컨테이너 헬스 그리드 (postfix/dovecot/rspamd/sogo/mysql-mailcow/redis-mailcow …)
- "도메인 추가"는 폼 입력 → mailcow API 호출로만 수행 (DKIM 값은 절대 수기 입력 불가, mailcow가 자체 생성한 값만 표시)

### 3.9 마인크래프트 (`/minecraft`)
- NSSM 서비스(Velocity + Paper N대) 상태, 시작/중지/재시작
- 로그 tail (NSSM stdout/stderr 리다이렉션 파일)
- (2단계 이후) RCON 연동으로 접속자 수 표시

### 3.10 감사 로그 (`/audit`)
- 모든 변경 작업(재시작, 배포, DNS/라우팅 변경, 도메인 추가 등)을 행위자/시각/대상/변경 전후 값으로 기록, 필터 검색 가능

---

## 4. 기능 요구사항 요약 (7개 영역 대응표)

| # | 영역 | 조회 기능 | 제어 기능 |
|---|---|---|---|
| 1 | PM2 | 프로세스 목록/상태/리소스, 실시간 로그, `dump.pm2` 동기화 여부 | start/stop/restart/reload, `pm2 save` |
| 2 | 리버스 프록시 | 라우팅 테이블, 리다이렉트 규칙, 인증서 만료일 | 라우트 추가/수정/삭제(파일 반영+리로드) |
| 3 | DNS/TLS | 레코드 목록, 프록시 상태, 오리진 IP 검증 | A레코드 추가/수정, orange/grey 토글 |
| 4 | 배포 워크플로우 | 로컬 vs 원격 diff, 변경 파일(패키지/스키마) 감지 | fetch→diff→install→migrate→build→restart→save 파이프라인 실행, 롤백 |
| 5 | 데이터베이스 | 스키마 목록/크기, 백업 최신성 | (백업 트리거만, 직접 쿼리 제공 안 함) |
| 6 | 메일서버 | 도메인/DKIM/쿼터, 컨테이너 헬스 | 도메인 추가(DKIM은 mailcow 자체 생성) |
| 7 | 마인크래프트 | 서비스 상태, 로그 | start/stop/restart |

---

## 5. 데이터 모델 (Ops Console 자체 메타데이터)

기존 공유 MySQL에 `ops_console` 스키마를 하나 추가해 사용한다 (다른 앱들과 동일한 패턴).

```sql
apps(
  id, name, type ENUM('node-app','static-web','discord-bot','minecraft'),
  repo_url, local_path, branch,
  runtime ENUM('pm2','nssm'), pm2_name, nssm_service,
  framework ENUM('next','vite','node-custom','other'),  -- 실행 커맨드 템플릿 선택용
  start_cmd,             -- 예: "next start -p {port}", "vite preview --port {port} --host",
                          -- "--interpreter node dist/index.js" — 온보딩 마법사(§3.3)가
                          -- PM2 ecosystem 항목을 생성할 때 사용
  port, domain, zone, preserve_host_header BOOLEAN,
  build_cmd, migrate_cmd, deploy_commands_cmd, commands_path,
  healthcheck_url, db_schema, created_at
)

deploy_logs(
  id, app_id, triggered_by, from_commit, to_commit,
  status ENUM('running','success','failed'),
  steps_json,           -- 각 단계별 결과/로그 경로
  started_at, finished_at
)

dns_cache(
  id, zone, record_type, name, content, proxied, ttl, synced_at
)

certs(
  id, domain, issuer, source ENUM('cloudflare-origin','letsencrypt'),
  not_before, not_after, file_path
)

audit_log(
  id, actor, action, target_type, target_id,
  detail_json, ip, created_at
)

users(
  id, email, password_hash, totp_secret, role ENUM('admin','viewer')
)
```

---

## 6. 시스템별 연동 설계 (핵심)

이 프로젝트에서 가장 중요한 부분 — 각 인프라 요소가 대부분 "관리용 API가 없는" 것들이라, 어떻게 안전하게 감싸는지가 설계의 핵심이다.

### 6.1 PM2
- Ops Console과 PM2 데몬이 같은 서버에 있으므로 `pm2` npm 패키지의 프로그래매틱 API(`pm2.connect`, `pm2.list`, `pm2.restart`, `pm2.describe`, `pm2.launchBus`)를 직접 사용 (네트워크 호출 아님, 로컬 IPC)
- 실시간 로그는 `pm2.launchBus()`의 로그 이벤트를 SSE로 브라우저에 중계
- `pm2 jlist`의 `pm_exec_path`/`exec_interpreter`를 보고 "권장 실행 방식(`--interpreter node` + 실제 `.js` 엔트리)"을 따르지 않는 앱은 대시보드에서 경고 배지 표시
- `dump.pm2` 파일을 파싱해 저장된 목록과 현재 `pm2 jlist` 결과를 비교, 다르면 "저장 안 된 변경 있음" 알림 + "pm2 save" 버튼 노출

### 6.2 리버스 프록시 (webproxy)
- 현재 `router` 객체가 `server.js`에 하드코딩되어 있다면, **`E:\webproxy\routes.json`** 같은 외부 설정 파일로 분리하는 작은 리팩터링이 선행 작업으로 필요
- webproxy는 시작 시 이 파일을 로드하고, 파일 변경을 감지(`chokidar` 등)하면 라우팅 테이블만 인메모리로 핫리로드 (프로세스 재시작 없이 무중단 반영)
- `mail.kjh9211.kr`처럼 `proxyReq` 훅으로 Host 헤더를 유지해야 하는 특수 케이스는 일반 라우팅(Host → 포트)과 스키마가 다르므로, `routes.json`에 `{ host, target, preserveHostHeader: true }` 형태로 특수 플래그를 명시적으로 표현하고 온보딩 마법사(§3.3)에서도 "Host 헤더 유지 필요" 체크박스로 노출한다. 임의의 커스텀 훅 코드를 UI에서 작성하게 하지는 않는다 — webproxy 쪽에 미리 정의된 몇 가지 훅 종류(Host 유지, 없음)만 선택 가능하게 한다.
- **SNI 인증서(`addContext`) 리로드는 라우팅 리로드와 별개의 메커니즘이다.** 라우팅 테이블 파일을 리로드해도 HTTPS 서버가 이미 `addContext()`로 등록한 SNI 컨텍스트 목록은 바뀌지 않으므로, 새 도메인을 추가하거나 인증서를 갱신했을 때 TLS 핸드셰이크 단계에서 막힐 수 있다. 따라서 webproxy에 `/admin/certs/reload` 같은 내부 전용 엔드포인트(또는 라우팅과 동일한 파일 워처)를 별도로 두어 `certs/` 폴더를 다시 스캔하고 `addContext()`를 재등록하도록 한다. §3.5(인증서 현황) 화면의 "적용" 액션은 반드시 이 리로드까지 트리거해야 한다.
- Ops Console은 이 JSON 파일을 읽고/씀 (직접 파일 쓰기 또는 webproxy가 `127.0.0.1`에만 열어두는 내부 전용 `/admin/routes`, `/admin/certs/reload` 엔드포인트 경유 — 후자가 검증 로직을 한곳에 모을 수 있어 더 안전)
- 저장 전 **검증(포트 중복, 문법 오류)** 을 반드시 거치고, 실패 시 기존 설정 유지 — 여기서 오류가 나면 전체 서비스가 영향받으므로 가장 보수적으로 다뤄야 하는 영역
- `certs/` 폴더의 인증서는 `node-forge` 등으로 파싱해 도메인(SAN)/발급자/만료일 추출

### 6.3 DNS/TLS (Cloudflare)
- Cloudflare API Token(Zone:DNS:Edit, Zone:Zone:Read로 스코프 최소화)을 서버 환경변수로 보관
- 존별 레코드 목록 조회 → `dns_cache`에 캐싱 후 주기적 동기화, 오리진 IP(`49.174.34.38`)와 다른 레코드/의도와 다른 proxied 값 강조
- Origin CA 인증서 발급 상태는 Cloudflare API의 `origin_ca` 엔드포인트로 조회 가능한 범위까지 반영
- 모든 Cloudflare 호출은 서버 사이드 전용, 토큰은 프론트엔드에 절대 전달하지 않음

### 6.4 배포 워크플로우
- `simple-git`으로 각 앱 로컬 클론에 대해 `fetch` → `git status --porcelain`(로컬 미커밋 변경 확인) → `git merge --ff-only` 시도
- ff-only가 실패하면(로컬에 별도 커밋 존재) **자동 처리하지 않고 사람에게만 알림** — 기존 운영 원칙("히스토리 꼬임/강제 머지 없음")을 그대로 코드화
- **`git status --porcelain`에 결과가 있으면(설정 파일, 데이터 파일 등 로컬 미커밋 변경) 이 시점에서 파이프라인을 자동으로 멈춘다.** 병합 시 덮어써지거나 충돌할 파일 목록을 "업데이트 확인" 화면에 보여주고, 관리자가 파일별로 "무시하고 진행" 또는 "중단"을 명시적으로 선택해야만 다음 단계(merge)로 넘어간다 — 원본 운영 원칙("pull 전 충돌 여부 확인")을 그대로 파이프라인 단계로 코드화한 것이다.
- `package.json`/`schema.sql` diff 여부에 따라 `npm install`/마이그레이션 단계를 조건부 실행
- `deploy-commands`(Discord 슬래시 커맨드 재등록) 실행 여부는 `apps.commands_path`(예: `src/commands/`)로 지정된 경로에 diff가 있는지로 판단 — `commands_path`가 비어 있는 앱(슬래시 커맨드가 없는 봇, 웹앱 등)은 이 단계 자체를 건너뛴다
- 파이프라인: fetch → 로컬 미커밋 변경 확인(있으면 정지 및 확인 요청) → diff 표시(패키지/스키마/커맨드 변경 여부 포함) → (승인) → ff-only merge → 조건부 install/migrate → build → 조건부 deploy-commands → pm2 restart(or nssm restart) → 헬스체크 → pm2 save
- 각 단계 stdout/stderr를 SSE로 실시간 스트리밍하고 `deploy_logs`에 영구 저장
- 롤백: 배포 이력에서 이전 커밋 선택 → 동일 파이프라인을 그 커밋 기준으로 재실행. `git merge --ff-only`로는 뒤로 돌아갈 수 없으므로(항상 앞으로만 fast-forward) 롤백만 `git reset --hard <커밋>`을 사용 — 서버에 배포된 로컬 체크아웃을 특정 시점으로 되돌리는 게 이 기능의 목적 자체이므로 여기서는 안전하고 의도된 사용
- **구현 시 확정 (Phase 2)**: 배포 로그 조회/실행 상태는 DB(`deploy_logs`)에 매 단계마다 즉시 기록해 새로고침해도 항상 최신 진행상황이 보이도록 하고, 실시간 스트리밍은 Ops Console 프로세스 내 인메모리 이벤트 버스로 구현(§2에서 이미 전제한 "단일 pm2 인스턴스" 가정과 동일) — 별도 메시지 큐 없이 충분
- 동시에 같은 앱에 대해 배포가 두 번 실행되는 것(git 저장소/프로세스 경합)은 "이미 진행 중인 배포가 있으면 새 배포를 거부"하는 방식으로 방지

### 6.5 데이터베이스
- 최소 권한(SELECT + `information_schema` 조회)의 전용 모니터링 계정으로 `mysql2` 연결
- 스키마별 크기는 `information_schema.tables`의 `data_length + index_length` 합산
- 백업은 Ops Console이 스케줄을 소유(주기적 `mysqldump` 트리거 + 보관 주기 관리)하거나, 기존 백업 스크립트가 있다면 그 결과(마지막 성공 시각)만 수집
- mailcow 내부 MySQL은 완전히 별개이므로 조회 대상에서 명시적으로 제외

### 6.6 메일 서버 (mailcow)
- mailcow REST API(`/api/v1/...`, `X-API-Key`)로 도메인/메일박스/DKIM 상태 조회
- 도메인 추가는 API 호출만 수행하고, **DKIM 키는 절대 직접 생성/복사하지 않음** — mailcow가 자체 생성한 결과만 표시 (기존 원칙 그대로 반영)
- Docker 컨테이너 상태는 `dockerode` 또는 `docker compose ps` 셸 호출로 조회 (mailcow-dockerized 스택 대상)

### 6.7 마인크래프트 (NSSM)
- Windows 서비스이므로 PowerShell(`Get-Service`, `nssm.exe status/start/stop/restart`)을 `child_process`로 호출
- NSSM이 stdout/stderr를 리다이렉트하는 로그 파일을 tail하여 실시간 로그 제공
- **Windows 서비스 start/stop은 기본적으로 관리자 권한이 필요**하다. Ops Console은 다른 앱들과 동일하게 PM2로 관리되므로(§2), PM2 데몬이 실행되는 OS 계정과 별개로 NSSM 서비스 제어용 저권한 계정을 새로 두는 것은 이 아키텍처상 실질적으로 어렵다. 따라서 다음 중 하나로 명시적으로 결정하고 진행한다:
  - (권장) 대상 마인크래프트 서비스들에 한해 `sc sdset`으로 서비스 ACL을 조정해, Ops Console을 구동하는 OS 계정에게 딱 그 서비스들의 시작/중지/조회 권한만 부여 — 관리자 권한 상시 필요 없이 최소 권한 유지
  - (대안) 관리자 권한이 필요한 위 3개 액션만 별도의 소형 상주 헬퍼(관리자 권한으로 등록된 별도 Windows 서비스)에 위임하고, Ops Console 본체는 그 헬퍼에 로컬 IPC/named pipe로만 요청 — 본체 프로세스 자체는 승격 없이 유지
  - PM2 데몬 자체를 관리자 권한 세션에서 띄우는 방식은 Ops Console 외 다른 모든 앱까지 불필요하게 승격시키므로 채택하지 않는다
- 이 결정은 §7 보안 설계의 "최소 권한" 원칙과 직결되므로, 실제 구현 착수 전(Phase 1) 반드시 위 옵션 중 하나를 확정한다
- **결정 (Phase 1 구현 시 확정)**: 권장안 (a) `sc sdset` 채택. 별도 헬퍼 프로세스는 이 시점에 들이기엔 구현 비용 대비 이득이 낮다고 판단 — 대상 서비스가 몇 개(Velocity + Paper N대) 뿐이라 ACL 조정으로 충분함. 정확한 `sc sdset` 명령과 절차는 README.md의 "Windows에 배포하기" 섹션에 문서화. 코드는 `src/lib/adapters/nssm.ts`의 `controlWindowsService()`가 항상 일반 사용자 권한으로 `Start-Service`/`Stop-Service`/`Restart-Service`를 호출하고, ACL이 아직 설정되지 않은 서비스에 대해서는 크래시 없이 접근 거부 오류를 그대로 반환한다.

---

## 7. 보안 설계

이 도구는 사실상 서버 전체에 대한 통제권을 갖기 때문에 가장 신경 써야 하는 부분이다.

- **인증**: 자체 회원가입 없는 단일/소수 관리자 계정 + TOTP 2FA 필수, 세션 쿠키는 `HttpOnly` + `Secure` + 짧은 만료
- **네트워크**: webproxy를 통해 인터넷에 노출되는 구조이므로, 앱 자체 로그인 위에 **Cloudflare Access(Zero Trust)** 또는 IP 허용목록을 추가로 걸어 이중 방어
- **권한 분리**: `users.role`에 `admin`/`viewer` 값은 §1의 "1인 운영 전제"에 맞춰 스키마에만 미리 자리를 잡아두고, **실제 로그인 화면·역할 전환 UI는 만들지 않는다.** 1인 운영에서 이 구분은 실질적 가치가 낮고, 나중에 협업자가 생기면 스키마 변경 없이 UI만 추가하면 되도록 여지만 남겨두는 것 — 과설계를 피하기 위해 Phase 5(§9) 이전에는 사실상 `admin` 단일 계정으로만 동작
- **감사 로그**: 모든 변경 작업(재시작, 배포, DNS/라우팅/도메인 변경)을 append-only로 기록, 행위자·시각·대상·변경 전후 값 포함
- **위험 작업 확인**: 재시작/삭제/DNS 변경 등은 클릭 즉시 실행하지 않고 확인 모달 + (선택) 2차 확인
- **비밀 관리**: Cloudflare API 토큰, mailcow API 키, DB 자격증명은 `.env`/Windows Credential Manager에만 보관, DB나 클라이언트에 저장하지 않음, 최소 스코프로 발급
- **임의 명령 실행 금지**: "명령어 입력 콘솔" 같은 기능은 만들지 않고, 모든 액션은 사전에 정의된 파라미터화된 작업만 허용
- **webproxy 설정 변경 안전장치**: 적용 전 검증, 실패 시 자동 롤백 — 이 부분 오류는 전체 서비스 장애로 직결되므로 가장 보수적으로 설계

---

## 8. 기술 스택 제안

기존 스택(Node/Next.js/PM2/MySQL)과 최대한 맞춰서 새로운 학습 비용 없이 유지보수 가능하게 구성.

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js (App Router) | 기존 웹앱들과 동일한 스택, 이 서버도 PM2로 그대로 관리 가능 |
| 실시간 로그/진행상황 | Server-Sent Events | 단방향이면 충분, WebSocket보다 단순 |
| PM2 연동 | `pm2` npm 패키지(로컬 API) | CLI 파싱보다 안정적 |
| Windows 서비스 제어 | PowerShell 호출 (`child_process`) | NSSM 전용 API가 없어 CLI 래핑이 최선 |
| Docker(mailcow) | `dockerode` | 코드에서 컨테이너 상태 직접 조회 |
| Git | `simple-git` | fetch/diff/merge --ff-only 제어 |
| DB | `mysql2` (전용 최소권한 계정) | 기존 MySQL 8.0과 동일 인스턴스 사용 |
| Cloudflare | 공식 Cloudflare SDK 또는 REST v4 fetch | DNS/인증서 상태 연동 |
| mailcow | REST API fetch (`X-API-Key`) | 공식 API 그대로 사용 |
| 인증서 파싱 | `node-forge` | `certs/` 폴더 파일 분석 |
| 인증 | 자체 세션 + TOTP(`otpauth`) | 외부 IdP 없이 단순하게 |
| 알림 | Discord 웹훅 | 기존에 Discord 봇을 이미 운영 중이라 자연스러운 채널 |

---

## 9. 로드맵

| 단계 | 범위 |
|---|---|
| Phase 0 | 앱 레지스트리 + 로그인/2FA + **읽기 전용** 대시보드 (PM2 상태, NSSM 상태, 인증서 만료일, git 로컬/원격 diff만 표시, 제어 기능 없음) |
| Phase 1 | 제어 기능 추가: pm2/nssm start/stop/restart, 실시간 로그 tail, 감사 로그. (`pm2 reload`의 무중단 롤링 재시작은 cluster 모드 프로세스에서만 의미가 있고 현재 앱들은 fork 모드 컨벤션(§6.1)이라 이번 범위에서 제외 — cluster 모드 앱이 생기면 추가) |
| Phase 2 | 배포 파이프라인 자동화: 업데이트 확인 → 배포 실행 원클릭, 실행 로그 스트리밍, 배포 이력, 롤백. 로컬 미커밋 변경 발견 시 자동 중단(§6.4)은 관리자가 "무시하고 진행" 체크박스로 명시적으로 넘겨야만 통과되도록 구현 |
| Phase 3 | 리버스 프록시 라우팅 CRUD(파일 기반 핫리로드) + Cloudflare DNS 조회/편집 + 인증서 통합 현황 |
| Phase 4 | mailcow 연동(도메인/DKIM/컨테이너 헬스), 신규 앱 온보딩 마법사(1~4단계 통합) |
| Phase 5 | Discord 알림, MySQL 백업 모니터링, 권한 세분화, 모바일 대응 UI |

Phase 0~1은 **읽기+재시작 정도만** 다루기 때문에 리스크가 낮고, 가장 반복적으로 확인하던 정보(지금 뭐가 떠있나, 뭐가 고장났나)를 즉시 줄여준다. 가장 위험한 영역(webproxy 라우팅, DNS, mailcow 도메인 변경)은 의도적으로 Phase 3~4로 미뤄서, 도구 자체의 신뢰도가 쌓인 뒤에 손대도록 순서를 잡았다.

---

## 10. 리스크 및 고려사항

- **webproxy는 라이브 트래픽을 받는 프로세스**이므로 라우팅 설정을 파일 기반으로 바꾸는 리팩터링 자체가 첫 위험 지점 — 반드시 스테이징 검증 후 적용, 실패 시 이전 설정으로 자동 복귀
- **Ops Console을 SPOF로 만들지 않기**: 이 도구가 다운되어도 각 앱/프록시/서비스는 지금처럼 독립적으로 동작해야 함(오케스트레이션 엔진이 아니라 제어판이라는 원칙 유지)
- **Windows 권한 문제**: NSSM 서비스 제어, git 작업, npm install 등은 실행 계정의 권한에 따라 제약이 있을 수 있어 최소 권한 계정 설계가 선행되어야 함
- **토큰 유출 파급력**: Cloudflare/mailcow API 토큰이 유출되면 도메인 전체 DNS/메일 도메인을 조작당할 수 있으므로 스코프 최소화 + 주기적 로테이션 필요
- **1인 운영 전제**: 다중 관리자 동시 편집 충돌(특히 라우팅/DNS)은 이번 범위에서 낙관적 잠금 정도로만 처리하고, 본격적인 동시성 제어는 후순위
