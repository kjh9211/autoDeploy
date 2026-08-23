"use client";

import { useActionState } from "react";
import { controlApp, type ControlAppState } from "./actions";
import type { Health } from "@/lib/status";

const CONFIRM_MESSAGE: Record<string, string> = {
  stop: "정말 중지할까요?",
  restart: "정말 재시작할까요?",
};

const buttonClass =
  "rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 text-sm font-medium disabled:opacity-40";

export function ControlButtons({ appId, health }: { appId: number; health: Health }) {
  const [state, formAction, pending] = useActionState<ControlAppState, FormData>(
    controlApp,
    null,
  );

  return (
    <div className="flex flex-col gap-2">
      <form
        action={formAction}
        className="flex gap-2"
        onSubmit={(e) => {
          const submitter = (e.nativeEvent as SubmitEvent).submitter as
            | HTMLButtonElement
            | null;
          const action = submitter?.value;
          const confirmMessage = action ? CONFIRM_MESSAGE[action] : undefined;
          if (confirmMessage && !window.confirm(confirmMessage)) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="id" value={appId} />
        <button
          type="submit"
          name="action"
          value="start"
          disabled={pending || health === "ok"}
          className={buttonClass}
        >
          시작
        </button>
        <button
          type="submit"
          name="action"
          value="stop"
          disabled={pending || health === "down"}
          className={buttonClass}
        >
          중지
        </button>
        <button
          type="submit"
          name="action"
          value="restart"
          disabled={pending || health === "down"}
          className={buttonClass}
        >
          재시작
        </button>
      </form>

      {state && "error" in state && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}
      {state && "ok" in state && state.ok && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">완료되었습니다.</p>
      )}
    </div>
  );
}
