import { AppForm } from "@/components/AppForm";
import { config } from "@/lib/config";
import { createApp } from "./actions";
import { OnboardingFields } from "./OnboardingFields";

export default function NewAppPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">새 앱 등록</h1>
        <p className="text-sm text-black/50 dark:text-white/50 mt-1">
          앱 메타데이터를 등록하고, 원하면 webproxy 라우팅과 Cloudflare DNS 레코드까지 한 번에
          생성합니다(docs/PLANNING.md §3.3).
        </p>
      </div>
      <AppForm
        action={createApp}
        submitLabel="등록"
        extraFields={<OnboardingFields zones={config.cloudflareZones} />}
      />
    </div>
  );
}
