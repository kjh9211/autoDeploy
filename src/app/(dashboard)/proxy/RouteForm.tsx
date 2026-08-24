"use client";

import { useActionState, useState } from "react";
import { upsertRoute, type RouteFormState } from "./actions";
import type { WebproxyRoute } from "@/lib/adapters/webproxy";

const inputClass =
  "rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2";

export function RouteForm({
  defaults,
  onSaved,
}: {
  defaults?: WebproxyRoute;
  onSaved?: () => void;
}) {
  const [state, formAction, pending] = useActionState<RouteFormState, FormData>(
    upsertRoute,
    null,
  );
  const [kind, setKind] = useState<"proxy" | "redirect">(defaults?.kind ?? "proxy");

  if (state && "ok" in state && state.ok) onSaved?.();

  return (
    <form action={formAction} className="flex flex-col gap-3 max-w-md">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Host</span>
        <input
          type="text"
          name="host"
          required
          defaultValue={defaults?.host}
          readOnly={!!defaults}
          placeholder="예: bot.kjh9211.kr"
          className={`${inputClass} ${defaults ? "opacity-60" : ""}`}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">유형</span>
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as "proxy" | "redirect")}
          className={inputClass}
        >
          <option value="proxy">리버스 프록시</option>
          <option value="redirect">302 리다이렉트</option>
        </select>
      </label>

      {kind === "proxy" ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">대상 포트</span>
            <input
              type="number"
              name="targetPort"
              required
              defaultValue={defaults?.kind === "proxy" ? defaults.targetPort : undefined}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="preserveHostHeader"
              defaultChecked={defaults?.kind === "proxy" ? defaults.preserveHostHeader : false}
            />
            Host 헤더 유지 (예: mail.kjh9211.kr)
          </label>
        </>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">리다이렉트 대상 URL</span>
          <input
            type="text"
            name="redirectTo"
            required
            defaultValue={defaults?.kind === "redirect" ? defaults.redirectTo : undefined}
            placeholder="https://..."
            className={inputClass}
          />
        </label>
      )}

      {state && "error" in state && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "저장 중…" : "저장"}
      </button>
    </form>
  );
}
