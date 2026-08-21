import { AppForm } from "@/components/AppForm";
import { createApp } from "./actions";

export default function NewAppPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">새 앱 등록</h1>
        <p className="text-sm text-black/50 dark:text-white/50 mt-1">
          메타데이터만 등록합니다. PM2/프록시/DNS 자동 생성을 포함한 온보딩
          마법사는 이후 단계(docs/PLANNING.md §9 Phase 3~4)에서 지원됩니다.
        </p>
      </div>
      <AppForm action={createApp} submitLabel="등록" />
    </div>
  );
}
