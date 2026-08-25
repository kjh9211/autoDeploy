"use client";

import { useActionState, useState } from "react";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";

export type AppFormState = { error: string } | null;
type AppFormAction = (
  state: AppFormState,
  formData: FormData,
) => Promise<AppFormState>;

export type AppFormDefaults = {
  id?: number;
  name?: string;
  type?: string;
  runtime?: string;
  pm2Name?: string;
  nssmService?: string;
  localPath?: string;
  branch?: string;
  domain?: string;
  logPath?: string;
  buildCmd?: string;
  migrateCmd?: string;
  deployCommandsCmd?: string;
  commandsPath?: string;
  healthcheckUrl?: string;
  notes?: string;
};

const inputClass =
  "rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2";

export function AppForm({
  action,
  defaults,
  submitLabel,
  extraFields,
}: {
  action: AppFormAction;
  defaults?: AppFormDefaults;
  submitLabel: string;
  // Slot for /apps/new's onboarding-wizard fields (docs/PLANNING.md §3.3) —
  // only meaningful at creation time, so edit forms just omit it.
  extraFields?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<AppFormState, FormData>(
    action,
    null,
  );
  const [runtime, setRuntime] = useState(defaults?.runtime ?? "pm2");

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-xl">
      <SubmitLoadingOverlay label="저장하는 중입니다…" />
      {defaults?.id !== undefined && (
        <input type="hidden" name="id" value={defaults.id} />
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">이름</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={defaults?.name}
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">유형</span>
        <select
          name="type"
          defaultValue={defaults?.type ?? "node_app"}
          className={inputClass}
        >
          <option value="node_app">Node 앱</option>
          <option value="static_web">정적 웹앱 (Next.js/Vite)</option>
          <option value="discord_bot">Discord 봇</option>
          <option value="minecraft">마인크래프트</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">런타임</span>
        <select
          name="runtime"
          value={runtime}
          onChange={(e) => setRuntime(e.target.value)}
          className={inputClass}
        >
          <option value="pm2">PM2</option>
          <option value="nssm">NSSM (Windows 서비스)</option>
        </select>
      </label>

      {runtime === "pm2" ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">PM2 프로세스 이름</span>
          <input
            type="text"
            name="pm2Name"
            defaultValue={defaults?.pm2Name}
            placeholder="pm2 list에 표시되는 이름"
            className={inputClass}
          />
        </label>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">NSSM 서비스 이름</span>
            <input
              type="text"
              name="nssmService"
              defaultValue={defaults?.nssmService}
              placeholder="Windows 서비스 이름"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">로그 파일 경로 (선택)</span>
            <input
              type="text"
              name="logPath"
              defaultValue={defaults?.logPath}
              placeholder="예: E:\minecraft\velocity\logs\latest.log — 실시간 로그 보기에 사용"
              className={inputClass}
            />
          </label>
        </>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">로컬 git 경로 (선택)</span>
        <input
          type="text"
          name="localPath"
          defaultValue={defaults?.localPath}
          placeholder="예: E:\apps\my-bot"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">배포 브랜치 (선택)</span>
        <input
          type="text"
          name="branch"
          defaultValue={defaults?.branch ?? "main"}
          className={inputClass}
        />
      </label>

      <fieldset className="flex flex-col gap-4 rounded-md border border-black/10 dark:border-white/10 p-3">
        <legend className="px-1 text-sm font-medium">배포 설정 (로컬 git 경로가 있을 때만 사용)</legend>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">빌드 명령 (선택)</span>
          <input
            type="text"
            name="buildCmd"
            defaultValue={defaults?.buildCmd}
            placeholder="예: npm run build"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">DB 마이그레이션 명령 (선택)</span>
          <input
            type="text"
            name="migrateCmd"
            defaultValue={defaults?.migrateCmd}
            placeholder="schema.sql이 바뀐 커밋을 배포할 때만 실행됨"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">슬래시 커맨드 배포 명령 (선택)</span>
          <input
            type="text"
            name="deployCommandsCmd"
            defaultValue={defaults?.deployCommandsCmd}
            placeholder="예: node deploy-commands.js"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">슬래시 커맨드 경로 (선택)</span>
          <input
            type="text"
            name="commandsPath"
            defaultValue={defaults?.commandsPath}
            placeholder="예: src/commands — 이 경로 변경 시에만 위 명령 실행"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">헬스체크 URL (선택)</span>
          <input
            type="text"
            name="healthcheckUrl"
            defaultValue={defaults?.healthcheckUrl}
            placeholder="재시작 후 확인할 URL — 없으면 이 단계는 건너뜀"
            className={inputClass}
          />
        </label>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">도메인 (선택)</span>
        <input
          type="text"
          name="domain"
          defaultValue={defaults?.domain}
          placeholder="예: bot.kjh9211.kr"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">메모 (선택)</span>
        <textarea
          name="notes"
          defaultValue={defaults?.notes}
          rows={3}
          className={inputClass}
        />
      </label>

      {extraFields}

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-md bg-foreground text-background px-4 py-2 font-medium disabled:opacity-50"
      >
        {pending ? "저장 중…" : submitLabel}
      </button>
    </form>
  );
}
