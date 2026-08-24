import { config } from "@/lib/config";

// Cloudflare API v4 client — docs/PLANNING.md §6.3. Server-side only, the
// token never reaches the client. Not verified against a live Cloudflare
// account (no token was available while building this); verified only
// against a mock server matching Cloudflare's documented response shape,
// so double-check the write paths (updateDnsRecord/createDnsRecord) before
// relying on them in production.

const API_BASE = "https://api.cloudflare.com/client/v4";

type CfEnvelope<T> = {
  success: boolean;
  errors: { code: number; message: string }[];
  result: T;
};

export type DnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied: boolean;
  ttl: number;
};

export type CfResult<T> = { ok: true; data: T } | { ok: false; error: string };

function notConfigured(): CfResult<never> {
  return { ok: false, error: "CLOUDFLARE_API_TOKEN이 설정되어 있지 않습니다." };
}

async function cf<T>(path: string, init?: RequestInit): Promise<CfResult<T>> {
  if (!config.CLOUDFLARE_API_TOKEN) return notConfigured();
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.CLOUDFLARE_API_TOKEN}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as CfEnvelope<T>;
    if (!body.success) {
      return {
        ok: false,
        error: body.errors?.map((e) => e.message).join(", ") || `HTTP ${res.status}`,
      };
    }
    return { ok: true, data: body.result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function findZoneId(zoneName: string): Promise<CfResult<string>> {
  const result = await cf<{ id: string }[]>(
    `/zones?name=${encodeURIComponent(zoneName)}`,
  );
  if (!result.ok) return result;
  const zone = result.data[0];
  if (!zone) return { ok: false, error: `존을 찾을 수 없습니다: ${zoneName}` };
  return { ok: true, data: zone.id };
}

export function listDnsRecords(zoneId: string): Promise<CfResult<DnsRecord[]>> {
  return cf<DnsRecord[]>(`/zones/${zoneId}/dns_records?per_page=200`);
}

export function updateDnsRecord(
  zoneId: string,
  recordId: string,
  patch: Partial<Pick<DnsRecord, "content" | "proxied">>,
): Promise<CfResult<DnsRecord>> {
  return cf<DnsRecord>(`/zones/${zoneId}/dns_records/${recordId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function createDnsRecord(
  zoneId: string,
  data: { type: string; name: string; content: string; proxied: boolean; ttl?: number },
): Promise<CfResult<DnsRecord>> {
  return cf<DnsRecord>(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({ ttl: 1, ...data }),
  });
}
