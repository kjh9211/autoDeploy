"use client";

import { useActionState } from "react";
import { reloadCerts, type ReloadCertsState } from "./actions";

export function ReloadCertsButton() {
  const [state, formAction, pending] = useActionState<ReloadCertsState, FormData>(
    reloadCerts,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "반영 중…" : "webproxy에 반영"}
      </button>
      {state && "error" in state && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {state.loaded.length}개 인증서 로드 완료
        </p>
      )}
    </form>
  );
}
