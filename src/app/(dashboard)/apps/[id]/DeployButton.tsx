"use client";

import { useActionState, useState } from "react";
import { startDeploy, type StartDeployState } from "./deployActions";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";

export function DeployButton({ appId }: { appId: number }) {
  const [state, formAction, pending] = useActionState<StartDeployState, FormData>(
    startDeploy,
    null,
  );
  const [force, setForce] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <SubmitLoadingOverlay label="배포를 시작하는 중입니다…" />
      <input type="hidden" name="id" value={appId} />
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
        className="self-start rounded-md bg-foreground text-background px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "시작하는 중…" : "배포 실행"}
      </button>
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
