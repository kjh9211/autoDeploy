# webproxy 연동 가이드 (Phase 3)

`E:\webproxy`는 이 저장소 밖의 별도 코드베이스라 Ops Console에서 직접 수정할 수 없다 (docs/PLANNING.md §6.2). 대신 Ops Console은 webproxy가 아래 계약(contract)을 만족하는 내부 전용 관리 API를 노출한다고 가정하고 `src/lib/adapters/webproxy.ts`를 구현해뒀다. **이 문서의 내용을 webproxy 쪽 코드에 실제로 반영해야 `/proxy`, `/proxy/certs`의 반영 버튼이 동작한다** — 반영 전에는 Ops Console이 "webproxy 관리 API에 연결할 수 없습니다"라는 안내만 보여주고 다른 기능에는 영향이 없다.

이 문서의 코드는 참고용 스케치다. 실제 `server.js`의 기존 `router` 객체/미들웨어 순서에 맞춰 적용해야 한다.

## 1. 왜 별도 리스너인가

관리 API는 **공개 443/80 리스너와 완전히 분리된, `127.0.0.1`에만 바인딩된 별도 HTTP 서버**로 띄운다. 공개 서버에 `/admin` 경로를 추가하는 방식은 방화벽/프록시 설정 실수 한 번으로 외부에 노출될 수 있어 채택하지 않는다.

```js
// admin-server.js
const http = require("http");
const crypto = require("crypto");

const ADMIN_TOKEN = process.env.WEBPROXY_ADMIN_TOKEN;

function checkToken(req) {
  const given = req.headers["x-admin-token"] || "";
  const expected = Buffer.from(ADMIN_TOKEN || "");
  const givenBuf = Buffer.from(given);
  return (
    expected.length > 0 &&
    givenBuf.length === expected.length &&
    crypto.timingSafeEqual(givenBuf, expected)
  );
}

const adminServer = http.createServer(async (req, res) => {
  if (!checkToken(req)) {
    res.writeHead(401).end(JSON.stringify({ error: "unauthorized" }));
    return;
  }
  // ... 라우팅은 아래 2절/3절 참고 ...
});

adminServer.listen(8443, "127.0.0.1");
```

Express를 이미 쓰고 있다면 `http.createServer(adminApp).listen(8443, "127.0.0.1")` 형태로 별도 Express 앱을 만들어도 된다 — 핵심은 **공개 서버와 다른 `http.Server` 인스턴스**여야 한다는 것과, `listen`의 두 번째 인자로 `"127.0.0.1"`을 반드시 지정하는 것이다.

## 2. 라우팅 테이블: `routes.json` + 핫리로드

기존에 `server.js`에 하드코딩돼 있다면, `E:\webproxy\routes.json`으로 분리한다.

```json
[
  { "host": "bot.kjh9211.kr", "kind": "proxy", "targetPort": 3001, "preserveHostHeader": false },
  { "host": "mail.kjh9211.kr", "kind": "proxy", "targetPort": 3002, "preserveHostHeader": true },
  { "host": "old.kjh9211.kr", "kind": "redirect", "redirectTo": "https://new.kjh9211.kr" }
]
```

```js
const fs = require("fs");
const path = require("path");

const ROUTES_FILE = path.join(__dirname, "routes.json");
let routes = new Map(); // host -> route object

function loadRoutes() {
  const parsed = JSON.parse(fs.readFileSync(ROUTES_FILE, "utf-8"));
  routes = new Map(parsed.map((r) => [r.host, r]));
}
loadRoutes();

// http-proxy-middleware의 router 옵션에 그대로 연결 — Host 헤더로 대상 포트를 찾는다.
function resolveTarget(req) {
  const route = routes.get(req.headers.host);
  if (!route || route.kind !== "proxy") return undefined;
  return `http://127.0.0.1:${route.targetPort}`;
}

// redirect 라우트는 프록시 미들웨어보다 먼저 걸어야 한다 (기존 원칙 그대로).
app.use((req, res, next) => {
  const route = routes.get(req.headers.host);
  if (route?.kind === "redirect") {
    res.redirect(302, route.redirectTo);
    return;
  }
  next();
});

app.use(
  createProxyMiddleware({
    router: resolveTarget,
    changeOrigin: true,
    on: {
      proxyReq: (proxyReq, req) => {
        const route = routes.get(req.headers.host);
        if (route?.kind === "proxy" && route.preserveHostHeader) {
          proxyReq.setHeader("host", req.headers.host);
        }
      },
    },
  }),
);
```

### 관리 API 핸들러

```js
function writeRoutesAtomic(nextRoutes) {
  const tmp = ROUTES_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify([...nextRoutes.values()], null, 2));
  fs.renameSync(tmp, ROUTES_FILE); // 같은 볼륨 내 rename은 원자적 — 쓰다 만 파일이 로드될 일 없음
}

function validateRoute(route, existingRoutes) {
  if (route.kind === "proxy") {
    const portInUse = [...existingRoutes.values()].some(
      (r) => r.host !== route.host && r.kind === "proxy" && r.targetPort === route.targetPort,
    );
    // 포트 중복 자체는 여러 앱이 같은 프로세스를 가리키는 의도일 수도 있어 에러 대신 참고만 하거나,
    // 정책에 따라 막을 수도 있다. 최소한 targetPort가 숫자인지 정도는 반드시 검증한다.
    if (!Number.isInteger(route.targetPort) || route.targetPort <= 0) {
      return "targetPort가 올바르지 않습니다.";
    }
  }
  if (route.kind === "redirect" && !route.redirectTo) {
    return "redirectTo가 필요합니다.";
  }
  return null;
}

// GET /routes
function handleListRoutes(req, res) {
  res.end(JSON.stringify({ routes: [...routes.values()] }));
}

// PUT /routes/:host  body: 나머지 필드 (host 제외)
function handleUpsertRoute(host, body, res) {
  const route = { host, ...body };
  const error = validateRoute(route, routes);
  if (error) {
    res.writeHead(400).end(JSON.stringify({ error }));
    return; // 검증 실패 시 기존 설정 유지 — 절대 반영하지 않는다
  }
  const next = new Map(routes);
  next.set(host, route);
  writeRoutesAtomic(next);
  routes = next; // 무중단 반영 — 프로세스 재시작 없음
  res.end(JSON.stringify({ ok: true }));
}

// DELETE /routes/:host
function handleDeleteRoute(host, res) {
  const next = new Map(routes);
  next.delete(host);
  writeRoutesAtomic(next);
  routes = next;
  res.end(JSON.stringify({ ok: true }));
}
```

Ops Console(`src/lib/adapters/webproxy.ts`)이 기대하는 응답 형태는 이게 전부다 — `GET /admin/routes` → `{ routes: [...] }`, `PUT /admin/routes/:host`/`DELETE /admin/routes/:host` → `{ ok: true }` 또는 `{ error: "..." }`(4xx).

## 3. 인증서 리로드: 라우팅과 별개 메커니즘

라우팅 테이블 리로드는 위처럼 무중단으로 가능하지만, TLS 서버가 이미 `addContext()`로 등록해둔 SNI 컨텍스트 목록은 별도로 갱신해야 한다 (docs/PLANNING.md §6.2). `certs/` 폴더에 새 인증서를 넣거나 갱신한 뒤에는 아래 엔드포인트를 반드시 호출해야 한다 — 라우팅 변경 시 자동으로 같이 실행되지 않는다.

```js
const forge = require("node-forge"); // Ops Console과 동일한 라이브러리 사용 권장

function reloadCerts(httpsServer, certsDir) {
  const loaded = [];
  for (const file of fs.readdirSync(certsDir)) {
    if (!/\.(pem|crt|cert|cer)$/i.test(file)) continue;
    const pem = fs.readFileSync(path.join(certsDir, file), "utf-8");
    let cert;
    try {
      cert = forge.pki.certificateFromPem(pem);
    } catch {
      continue;
    }
    const cn = cert.subject.attributes.find((a) => a.shortName === "CN")?.value;
    const keyPath = path.join(certsDir, file.replace(/\.(pem|crt|cert|cer)$/i, ".key"));
    if (!cn || !fs.existsSync(keyPath)) continue;
    httpsServer.addContext(cn, { cert: pem, key: fs.readFileSync(keyPath, "utf-8") });
    loaded.push(cn);
  }
  return loaded;
}

// POST /certs/reload
function handleReloadCerts(res) {
  const loaded = reloadCerts(httpsServer, CERTS_DIR);
  res.end(JSON.stringify({ ok: true, loaded }));
}
```

실제 인증서/키 파일 명명 규칙은 서버마다 다를 수 있으니 `certs/` 폴더의 실제 구조에 맞게 조정할 것.

## 4. 요약 — Ops Console이 기대하는 계약

| 메서드/경로 | 요청 | 성공 응답 | 실패 응답 |
|---|---|---|---|
| `GET /routes` | — | `{ routes: WebproxyRoute[] }` | — |
| `PUT /routes/:host` | 라우트 필드(JSON body) | `{ ok: true }` | `{ error: string }` (4xx), 기존 설정 유지 |
| `DELETE /routes/:host` | — | `{ ok: true }` | `{ error: string }` |
| `POST /certs/reload` | — | `{ ok: true, loaded: string[] }` | `{ error: string }` |

모든 요청에 `X-Admin-Token` 헤더가 `WEBPROXY_ADMIN_TOKEN`과 일치해야 한다. `WebproxyRoute`의 정확한 타입은 `src/lib/adapters/webproxy.ts`를 참고.

## 5. 적용 후 확인

1. webproxy를 재시작해 관리 API가 `127.0.0.1:8443`(또는 선택한 포트)에서 응답하는지 `curl -H "X-Admin-Token: ..." http://127.0.0.1:8443/admin/routes`로 직접 확인
2. Ops Console `.env`에 `WEBPROXY_ADMIN_URL`, `WEBPROXY_ADMIN_TOKEN` 설정 후 `/proxy` 접속 — 연결 안내 배너가 사라지고 라우팅 테이블이 보이면 성공
3. 테스트 라우트를 하나 추가/삭제해보고 실제 트래픽이 의도대로 흐르는지, `routes.json` 파일도 같이 갱신됐는지 확인
4. 인증서 폴더에 파일을 하나 바꾼 뒤 `/proxy/certs`에서 "webproxy에 반영"을 눌러 `loaded` 목록에 해당 도메인이 뜨는지 확인
