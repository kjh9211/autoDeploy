"use client";

import { useActionState, useState } from "react";
import { toggleProxied, updateContent, createRecord, type DnsActionState } from "./actions";
import { checkDnsRecord, DNS_ISSUE_LABEL } from "@/lib/dnsChecks";
import type { DnsRecord } from "@/lib/adapters/cloudflare";

const inputClass =
  "rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm";

function ProxiedToggle({ zoneId, record }: { zoneId: string; record: DnsRecord }) {
  const [state, formAction, pending] = useActionState<DnsActionState, FormData>(
    toggleProxied,
    null,
  );

  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="zoneId" value={zoneId} />
      <input type="hidden" name="recordId" value={record.id} />
      <input type="hidden" name="name" value={record.name} />
      <input type="hidden" name="nextProxied" value={(!record.proxied).toString()} />
      <button
        type="submit"
        disabled={pending}
        className="text-sm underline underline-offset-2 disabled:opacity-50"
      >
        {record.proxied ? "🟠 orange" : "⚪ grey"}
      </button>
      {state && "error" in state && (
        <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
    </form>
  );
}

function ContentEditor({ zoneId, record }: { zoneId: string; record: DnsRecord }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<DnsActionState, FormData>(
    updateContent,
    null,
  );

  if (state && "ok" in state && state.ok && editing) setEditing(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-left underline underline-offset-2 decoration-dotted"
      >
        {record.content}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="zoneId" value={zoneId} />
      <input type="hidden" name="recordId" value={record.id} />
      <input type="hidden" name="name" value={record.name} />
      <div className="flex gap-1">
        <input type="text" name="content" defaultValue={record.content} className={inputClass} />
        <button type="submit" disabled={pending} className="text-sm underline underline-offset-2">
          저장
        </button>
        <button type="button" onClick={() => setEditing(false)} className="text-sm text-black/50 dark:text-white/50">
          취소
        </button>
      </div>
      {state && "error" in state && (
        <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
    </form>
  );
}

function CreateRecordForm({ zoneName }: { zoneName: string }) {
  const [state, formAction, pending] = useActionState<DnsActionState, FormData>(
    createRecord,
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="zoneName" value={zoneName} />
      <label className="flex flex-col gap-1 text-xs">
        유형
        <select name="type" className={inputClass} defaultValue="A">
          <option value="A">A</option>
          <option value="CNAME">CNAME</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        이름
        <input type="text" name="name" required placeholder="new.example.com" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        값
        <input type="text" name="content" required placeholder="IP 또는 대상" className={inputClass} />
      </label>
      <label className="flex items-center gap-1 text-xs pb-1.5">
        <input type="checkbox" name="proxied" defaultChecked />
        proxied
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "추가 중…" : "레코드 추가"}
      </button>
      {state && "error" in state && (
        <span className="w-full text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
    </form>
  );
}

export function DnsZoneSection({
  zoneName,
  zoneId,
  records,
  originIp,
}: {
  zoneName: string;
  zoneId: string;
  records: DnsRecord[];
  originIp: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">{zoneName}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
              <th className="py-2 pr-4 font-medium">유형</th>
              <th className="py-2 pr-4 font-medium">이름</th>
              <th className="py-2 pr-4 font-medium">값</th>
              <th className="py-2 pr-4 font-medium">프록시</th>
              <th className="py-2 pr-4 font-medium">확인</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const issues = checkDnsRecord(record, originIp);
              return (
                <tr key={record.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2 pr-4">{record.type}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{record.name}</td>
                  <td className="py-2 pr-4">
                    {record.type === "A" ? (
                      <ContentEditor zoneId={zoneId} record={record} />
                    ) : (
                      record.content
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <ProxiedToggle zoneId={zoneId} record={record} />
                  </td>
                  <td className="py-2 pr-4">
                    {issues.length === 0 ? (
                      <span className="text-black/40 dark:text-white/40">—</span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">
                        {issues.map((i) => DNS_ISSUE_LABEL[i]).join(", ")}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {records.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-black/50 dark:text-white/50">
                  레코드가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <CreateRecordForm zoneName={zoneName} />
    </section>
  );
}
