export type Health = "ok" | "warn" | "down" | "unknown";

export function pm2StatusHealth(status: string | undefined): Health {
  switch (status) {
    case "online":
      return "ok";
    case "stopped":
    case "errored":
      return "down";
    case "launching":
    case "waiting_restart":
    case "one-launch-status":
    case "stopping":
      return "warn";
    default:
      return "unknown";
  }
}

export function windowsServiceHealth(status: string | undefined): Health {
  switch (status) {
    case "Running":
      return "ok";
    case "Stopped":
      return "down";
    case "StartPending":
    case "StopPending":
    case "Paused":
    case "PausePending":
    case "ContinuePending":
      return "warn";
    default:
      return "unknown";
  }
}

export const HEALTH_LABEL: Record<Health, string> = {
  ok: "정상",
  warn: "전환 중",
  down: "중지됨",
  unknown: "알 수 없음",
};

export const HEALTH_DOT_CLASS: Record<Health, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  down: "bg-red-500",
  unknown: "bg-gray-400",
};
