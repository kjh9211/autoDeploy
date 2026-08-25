"use client";

import { deleteApp } from "./actions";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";

export function DeleteAppButton({ appId, appName }: { appId: number; appName: string }) {
  return (
    <form
      action={deleteApp}
      onSubmit={(e) => {
        if (!window.confirm(`"${appName}" 앱 등록을 삭제할까요? PM2/서비스 자체는 삭제되지 않습니다.`)) {
          e.preventDefault();
        }
      }}
    >
      <SubmitLoadingOverlay label="삭제하는 중입니다…" />
      <input type="hidden" name="id" value={appId} />
      <button
        type="submit"
        className="rounded-md border border-red-600/40 text-red-600 dark:text-red-400 px-3 py-1.5 text-sm font-medium hover:bg-red-600/5"
      >
        등록 삭제
      </button>
    </form>
  );
}
