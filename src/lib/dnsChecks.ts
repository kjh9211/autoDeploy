import type { DnsRecord } from "@/lib/adapters/cloudflare";

// mail.* bypasses Cloudflare's proxy for direct SMTP/IMAP (docs/PLANNING.md
// §3/§6.3) — everything else is expected to stay orange-clouded.
export function expectsGreyCloud(recordName: string): boolean {
  return recordName.startsWith("mail.");
}

export type DnsRecordIssue = "wrong-ip" | "should-be-grey-cloud";

export function checkDnsRecord(record: DnsRecord, originIp: string): DnsRecordIssue[] {
  const issues: DnsRecordIssue[] = [];

  if (record.type === "A" && originIp && record.content !== originIp) {
    issues.push("wrong-ip");
  }
  if (expectsGreyCloud(record.name) && record.proxied) {
    issues.push("should-be-grey-cloud");
  }

  return issues;
}

export const DNS_ISSUE_LABEL: Record<DnsRecordIssue, string> = {
  "wrong-ip": "오리진 IP와 다름",
  "should-be-grey-cloud": "grey-cloud여야 함(mail.*)",
};
