import { config } from "@/lib/config";
import { findZoneId, listDnsRecords } from "@/lib/adapters/cloudflare";
import { DnsZoneSection } from "./DnsZoneSection";

export default async function DnsPage() {
  if (!config.CLOUDFLARE_API_TOKEN || config.cloudflareZones.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">DNS</h1>
        <div className="rounded-md border border-amber-600/40 p-4 text-sm">
          <p className="text-amber-700 dark:text-amber-400 font-medium">
            Cloudflare 연동이 설정되어 있지 않습니다.
          </p>
          <p className="mt-1 text-black/60 dark:text-white/60">
            <code>CLOUDFLARE_API_TOKEN</code>과 <code>CLOUDFLARE_ZONES</code>를 설정하면 이 화면이
            활성화됩니다.
          </p>
        </div>
      </div>
    );
  }

  const zones = await Promise.all(
    config.cloudflareZones.map(async (zoneName) => {
      const zoneIdResult = await findZoneId(zoneName);
      if (!zoneIdResult.ok) {
        return { zoneName, zoneId: null, error: zoneIdResult.error, records: [] };
      }
      const recordsResult = await listDnsRecords(zoneIdResult.data);
      if (!recordsResult.ok) {
        return { zoneName, zoneId: zoneIdResult.data, error: recordsResult.error, records: [] };
      }
      return { zoneName, zoneId: zoneIdResult.data, error: null, records: recordsResult.data };
    }),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">DNS</h1>
        <p className="text-sm text-black/50 dark:text-white/50 mt-1">
          오리진 IP {config.ORIGIN_IP || "(미설정)"} 기준으로 확인
        </p>
      </div>

      {zones.map((zone) =>
        zone.error ? (
          <div key={zone.zoneName} className="rounded-md border border-red-600/40 p-4 text-sm">
            <p className="font-medium">{zone.zoneName}</p>
            <p className="mt-1 text-red-600 dark:text-red-400">{zone.error}</p>
          </div>
        ) : (
          <DnsZoneSection
            key={zone.zoneName}
            zoneName={zone.zoneName}
            zoneId={zone.zoneId!}
            records={zone.records}
            originIp={config.ORIGIN_IP ?? ""}
          />
        ),
      )}
    </div>
  );
}
