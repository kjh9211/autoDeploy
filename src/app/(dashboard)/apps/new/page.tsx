import Link from "next/link";
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
          생성합니다(docs/PLANNING.md §3.3). 이미 PM2로 떠 있는 프로세스라면{" "}
          <Link href="/apps/new/from-pm2" className="underline underline-offset-2">
            PM2에서 가져오기
          </Link>
          로 이름/PM2 프로세스명을 자동으로 채울 수 있습니다.
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
