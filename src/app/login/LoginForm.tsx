"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <SubmitLoadingOverlay label="로그인 확인 중입니다…" />
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">이메일</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="username"
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">비밀번호</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">인증 앱 코드 (TOTP)</span>
        <input
          type="text"
          name="totpToken"
          required
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          autoComplete="one-time-code"
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 tracking-widest"
        />
      </label>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-foreground text-background px-4 py-2 font-medium disabled:opacity-50"
      >
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
