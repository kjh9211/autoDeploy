"use client";

import { useState } from "react";

const inputClass =
  "rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2";

export function OnboardingFields({ zones }: { zones: string[] }) {
  const [wantsProxy, setWantsProxy] = useState(false);
  const [wantsDns, setWantsDns] = useState(false);

  return (
    <fieldset className="flex flex-col gap-4 rounded-md border border-black/10 dark:border-white/10 p-3">
      <legend className="px-1 text-sm font-medium">
        배포 인프라 자동 설정 (선택 — 위 도메인 필드가 있어야 동작)
      </legend>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="createProxyRoute"
          checked={wantsProxy}
          onChange={(e) => setWantsProxy(e.target.checked)}
        />
        webproxy 라우팅도 함께 생성
      </label>
      {wantsProxy && (
        <div className="flex flex-col gap-3 pl-6">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">대상 포트</span>
            <input type="number" name="proxyTargetPort" className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="proxyPreserveHostHeader" />
            Host 헤더 유지
          </label>
        </div>
      )}

      {zones.length > 0 ? (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="createDnsRecord"
              checked={wantsDns}
              onChange={(e) => setWantsDns(e.target.checked)}
            />
            Cloudflare DNS 레코드도 함께 생성
          </label>
          {wantsDns && (
            <div className="flex flex-col gap-3 pl-6">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">존</span>
                <select name="dnsZone" className={inputClass}>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="dnsProxied" defaultChecked />
                orange-cloud (프록시 사용)
              </label>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-black/50 dark:text-white/50">
          CLOUDFLARE_ZONES가 설정되어 있지 않아 DNS 자동 생성은 비활성화되어 있습니다.
        </p>
      )}
    </fieldset>
  );
}
