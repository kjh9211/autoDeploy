"use client";

import { useActionState } from "react";
import { addMailDomain, type MailActionState } from "./actions";

const inputClass =
  "rounded-md border border-black/15 dark:border-white/20 bg-transparent px-2 py-1 text-sm";

export function AddDomainForm() {
  const [state, formAction, pending] = useActionState<MailActionState, FormData>(
    addMailDomain,
    null,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        도메인
        <input type="text" name="domain" required placeholder="example.com" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        메일박스 수
        <input type="number" name="mailboxes" defaultValue={10} className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        메일박스당 용량(MB)
        <input type="number" name="quota" defaultValue={3072} className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "추가 중…" : "도메인 추가"}
      </button>
      {state && "error" in state && (
        <span className="w-full text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
      {state && "ok" in state && state.ok && (
        <span className="w-full text-xs text-emerald-600 dark:text-emerald-400">
          도메인과 DKIM이 생성되었습니다.
        </span>
      )}
    </form>
  );
}
