"use client";

import { useActionState, useState } from "react";
import { rollbackToDeploy, type RollbackState } from "./actions";

export function RollbackButton({ deployId, commit }: { deployId: number; commit: string }) {
  const [state, formAction, pending] = useActionState<RollbackState, FormData>(
    rollbackToDeploy,
    null,
  );
  const [force, setForce] = useState(false);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        if (
          !window.confirm(
            `${commit.slice(0, 10)} 커밋으로 롤백할까요? 현재 배포된 코드가 이 시점으로 되돌아갑니다.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="deployId" value={deployId} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="force"
          checked={force}
          onChange={(e) => setForce(e.target.checked)}
        />
        로컬 미커밋 변경이 있어도 무시하고 진행
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md border border-amber-600/50 text-amber-700 dark:text-amber-400 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "롤백 중…" : `이 커밋(${commit.slice(0, 10)})으로 롤백`}
      </button>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
