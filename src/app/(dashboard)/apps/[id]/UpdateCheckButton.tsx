"use client";

import { useActionState } from "react";
import { checkAppGitUpdate } from "./actions";
import type { GitUpdateCheck } from "@/lib/adapters/git";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";

export function UpdateCheckButton({ appId }: { appId: number }) {
  const [state, formAction, pending] = useActionState<
    GitUpdateCheck | null,
    FormData
  >(checkAppGitUpdate, null);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction}>
        <SubmitLoadingOverlay label="업데이트를 확인하는 중입니다… (git fetch)" />
        <input type="hidden" name="id" value={appId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {pending ? "확인 중… (git fetch)" : "업데이트 확인"}
        </button>
      </form>

      {state && !state.ok && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      {state?.ok && (
        <div className="flex flex-col gap-2 text-sm rounded-md border border-black/10 dark:border-white/10 p-3">
          {state.dirtyFiles.length > 0 && (
            <p className="text-amber-600 dark:text-amber-400">
              로컬에 커밋되지 않은 변경이 있습니다 — 병합 전 반드시 확인하세요:{" "}
              {state.dirtyFiles.join(", ")}
            </p>
          )}

          <p>
            origin 대비 {state.ahead}개 앞섬 / {state.behind}개 뒤처짐
          </p>

          {state.behind > 0 && (
            <>
              <p className="text-black/60 dark:text-white/60">
                변경된 파일 {state.changedFiles.length}개
                {state.touchesPackageJson && " · package.json 변경 (npm install 필요)"}
                {state.touchesSchemaSql && " · schema.sql 변경 (DB 마이그레이션 필요)"}
              </p>
              <ul className="list-disc list-inside text-black/60 dark:text-white/60">
                {state.changedFiles.slice(0, 20).map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          )}

          {state.behind === 0 && (
            <p className="text-black/60 dark:text-white/60">
              최신 상태입니다 — 새 커밋이 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
