"use client";

import { useEffect, useState } from "react";

type StepStatus = "running" | "success" | "failed" | "skipped";
type Step = { name: string; status: StepStatus; output: string };
type OverallStatus = "running" | "success" | "failed";

const STEP_ICON: Record<StepStatus, string> = {
  running: "●",
  success: "✓",
  failed: "✗",
  skipped: "–",
};

const STEP_ICON_CLASS: Record<StepStatus, string> = {
  running: "text-amber-600 dark:text-amber-400",
  success: "text-emerald-600 dark:text-emerald-400",
  failed: "text-red-600 dark:text-red-400",
  skipped: "text-black/40 dark:text-white/40",
};

export function DeployLiveView({
  deployLogId,
  initialStatus,
}: {
  deployLogId: number;
  initialStatus: OverallStatus;
}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [overallStatus, setOverallStatus] = useState<OverallStatus>(initialStatus);

  useEffect(() => {
    const source = new EventSource(`/api/deploys/${deployLogId}/stream`);

    source.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "done") {
        setOverallStatus(data.status);
        source.close();
        return;
      }

      setSteps((prev) => {
        const next = [...prev];
        const idx = next.findIndex((s) => s.name === data.step);

        if (data.type === "step-start") {
          if (idx === -1) next.push({ name: data.step, status: "running", output: "" });
        } else if (data.type === "output" && idx >= 0) {
          next[idx] = { ...next[idx], output: next[idx].output + data.chunk };
        } else if (data.type === "step-end" && idx >= 0) {
          next[idx] = { ...next[idx], status: data.status };
        }
        return next;
      });
    };

    return () => source.close();
  }, [deployLogId]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">전체 상태:</span>
        {overallStatus === "running" && (
          <span className="text-amber-600 dark:text-amber-400">진행 중…</span>
        )}
        {overallStatus === "success" && (
          <span className="text-emerald-600 dark:text-emerald-400">성공</span>
        )}
        {overallStatus === "failed" && (
          <span className="text-red-600 dark:text-red-400">실패</span>
        )}
      </div>

      <ol className="flex flex-col gap-2">
        {steps.map((step) => (
          <li
            key={step.name}
            className="rounded-md border border-black/10 dark:border-white/10 p-3"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className={STEP_ICON_CLASS[step.status]}>{STEP_ICON[step.status]}</span>
              {step.name}
            </div>
            {step.output && (
              <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded bg-black text-white/90 text-xs p-2">
                {step.output}
              </pre>
            )}
          </li>
        ))}
        {steps.length === 0 && (
          <p className="text-sm text-black/50 dark:text-white/50">시작 대기 중…</p>
        )}
      </ol>
    </div>
  );
}
