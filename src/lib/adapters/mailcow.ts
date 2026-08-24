import { config } from "@/lib/config";

// mailcow REST API client (docs/PLANNING.md §6.6). Verified only against a
// mock server shaped like mailcow's documented API — this session had no
// real mailcow instance/API key to test against, so double-check endpoint
// paths and response shapes against the actual instance's API docs
// (https://<mail-host>/api/) before trusting this in production, especially
// the write paths (addDomain/ensureDkim).

export type MailcowResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type MailcowDomain = {
  domain: string;
  active: string; // "1" | "0" — mailcow's API returns these as strings
  mailboxes: string;
  quota: string;
  bytes_total: string;
};

export type MailcowMailbox = {
  username: string;
  active: string;
  quota: string;
};

export type DkimStatus =
  | { configured: true; selector: string; dkimTxt: string }
  | { configured: false };

function notConfigured(): MailcowResult<never> {
  return { ok: false, error: "MAILCOW_API_URL / MAILCOW_API_KEY이 설정되어 있지 않습니다." };
}

async function call<T>(path: string, init?: RequestInit): Promise<MailcowResult<T>> {
  if (!config.MAILCOW_API_URL || !config.MAILCOW_API_KEY) return notConfigured();
  try {
    const res = await fetch(`${config.MAILCOW_API_URL}/api/v1${path}`, {
      ...init,
      headers: {
        "X-API-Key": config.MAILCOW_API_KEY,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, error: `mailcow가 ${res.status}을 반환했습니다.` };
    const body = await res.json();
    return { ok: true, data: body as T };
  } catch (err) {
    return {
      ok: false,
      error: "mailcow API에 연결할 수 없습니다: " + (err instanceof Error ? err.message : String(err)),
    };
  }
}

// mailcow's add/* endpoints return an array of {type: "success"|"error"|"danger", msg}.
function addEndpointOk(body: unknown): { ok: boolean; message: string } {
  const list = Array.isArray(body) ? body : [body];
  const messages = list.map((r) => (typeof r?.msg === "string" ? r.msg : JSON.stringify(r?.msg ?? r)));
  const failed = list.some((r) => r?.type && r.type !== "success");
  return { ok: !failed, message: messages.join(", ") };
}

export function listDomains(): Promise<MailcowResult<MailcowDomain[]>> {
  return call<MailcowDomain[]>("/get/domain/all");
}

export function listMailboxes(domain: string): Promise<MailcowResult<MailcowMailbox[]>> {
  return call<MailcowMailbox[]>(`/get/mailbox/all/${encodeURIComponent(domain)}`);
}

export async function getDkimStatus(domain: string): Promise<MailcowResult<DkimStatus>> {
  const result = await call<{ dkim_txt?: string; dkim_selector?: string }>(
    `/get/dkim/${encodeURIComponent(domain)}`,
  );
  if (!result.ok) return result;
  if (!result.data.dkim_txt) return { ok: true, data: { configured: false } };
  return {
    ok: true,
    data: {
      configured: true,
      selector: result.data.dkim_selector ?? "dkim",
      dkimTxt: result.data.dkim_txt,
    },
  };
}

export async function addDomain(data: {
  domain: string;
  description?: string;
  mailboxes?: number;
  quota?: number;
}): Promise<MailcowResult<{ message: string }>> {
  const result = await call<unknown>("/add/domain", {
    method: "POST",
    body: JSON.stringify({
      domain: data.domain,
      description: data.description ?? "",
      mailboxes: data.mailboxes ?? 10,
      maxquota: data.quota ?? 3072,
      quota: (data.quota ?? 3072) * (data.mailboxes ?? 10),
      active: "1",
    }),
  });
  if (!result.ok) return result;
  const { ok, message } = addEndpointOk(result.data);
  return ok ? { ok: true, data: { message } } : { ok: false, error: message };
}

// Never constructs a DKIM value by hand — this only ever asks mailcow to
// generate one itself (docs/PLANNING.md §6.6's "절대 손으로 값을 복사하지
// 않음"), and only if one doesn't already exist.
export async function ensureDkim(domain: string): Promise<MailcowResult<DkimStatus>> {
  const existing = await getDkimStatus(domain);
  if (existing.ok && existing.data.configured) return existing;

  const created = await call<unknown>("/add/dkim", {
    method: "POST",
    body: JSON.stringify({ domains: domain, dkim_selector: "dkim", key_size: "2048" }),
  });
  if (!created.ok) return created;
  const { ok, message } = addEndpointOk(created.data);
  if (!ok) return { ok: false, error: message };

  return getDkimStatus(domain);
}
