"use client";

import { deleteRoute } from "./actions";

export function DeleteRouteButton({ host }: { host: string }) {
  return (
    <form
      action={deleteRoute}
      onSubmit={(e) => {
        if (!window.confirm(`"${host}" 라우트를 삭제할까요? webproxy에 즉시 반영됩니다.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="host" value={host} />
      <button
        type="submit"
        className="text-sm text-red-600 dark:text-red-400 underline underline-offset-2"
      >
        삭제
      </button>
    </form>
  );
}
