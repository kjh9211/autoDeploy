"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RouteForm } from "./RouteForm";
import { DeleteRouteButton } from "./DeleteRouteButton";
import type { WebproxyRoute } from "@/lib/adapters/webproxy";

export function RoutesPageClient({ routes }: { routes: WebproxyRoute[] }) {
  const router = useRouter();
  const [editingHost, setEditingHost] = useState<string | null>(null);
  const editingRoute = routes.find((r) => r.host === editingHost);

  const refresh = () => {
    setEditingHost(null);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
              <th className="py-2 pr-4 font-medium">Host</th>
              <th className="py-2 pr-4 font-medium">유형</th>
              <th className="py-2 pr-4 font-medium">대상</th>
              <th className="py-2 pr-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route.host} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2 pr-4 font-mono text-xs">{route.host}</td>
                <td className="py-2 pr-4">
                  {route.kind === "proxy" ? "리버스 프록시" : "302 리다이렉트"}
                </td>
                <td className="py-2 pr-4 text-black/60 dark:text-white/60">
                  {route.kind === "proxy"
                    ? `127.0.0.1:${route.targetPort}${route.preserveHostHeader ? " (Host 유지)" : ""}`
                    : route.redirectTo}
                </td>
                <td className="py-2 pr-4">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingHost(route.host)}
                      className="text-sm underline underline-offset-2"
                    >
                      수정
                    </button>
                    <DeleteRouteButton host={route.host} />
                  </div>
                </td>
              </tr>
            ))}
            {routes.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-black/50 dark:text-white/50">
                  등록된 라우트가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{editingRoute ? `라우트 수정 — ${editingRoute.host}` : "새 라우트 추가"}</h2>
        <RouteForm key={editingHost ?? "new"} defaults={editingRoute} onSaved={refresh} />
        {editingRoute && (
          <button
            type="button"
            onClick={() => setEditingHost(null)}
            className="self-start text-sm text-black/50 dark:text-white/50 underline underline-offset-2"
          >
            취소하고 새 라우트 추가로 돌아가기
          </button>
        )}
      </section>
    </div>
  );
}
