import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type WindowsServiceStatus =
  | { ok: true; status: string }
  | { ok: false; supported: false; error: string }
  | { ok: false; supported: true; error: string };

// The service name is passed through an env var rather than interpolated
// into the -Command string, so it can never break out of the PowerShell
// expression it's used in.
export async function getWindowsServiceStatus(
  serviceName: string,
): Promise<WindowsServiceStatus> {
  if (process.platform !== "win32") {
    return {
      ok: false,
      supported: false,
      error: "Windows 서비스 조회는 이 플랫폼에서 지원되지 않습니다.",
    };
  }

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "(Get-Service -Name $env:OPS_CONSOLE_SERVICE_NAME -ErrorAction Stop).Status",
      ],
      { env: { ...process.env, OPS_CONSOLE_SERVICE_NAME: serviceName } },
    );
    return { ok: true, status: stdout.trim() };
  } catch (err) {
    return {
      ok: false,
      supported: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export type WindowsServiceAction = "start" | "stop" | "restart";

export type WindowsServiceControlResult =
  | { ok: true }
  | { ok: false; error: string };

const POWERSHELL_VERB: Record<WindowsServiceAction, string> = {
  start: "Start-Service",
  stop: "Stop-Service",
  restart: "Restart-Service",
};

// Phase 1 control action (docs/PLANNING.md §9). Windows service start/stop
// normally needs admin rights — per §6.7 this assumes the recommended fix
// has been applied on the server: `sc sdset <service> ...` granting the Ops
// Console OS account SERVICE_START/STOP/QUERY_STATUS on just these services
// (see README.md). Without that ACL change this fails with an access-denied
// error surfaced as `error` below, not a crash.
export async function controlWindowsService(
  serviceName: string,
  action: WindowsServiceAction,
): Promise<WindowsServiceControlResult> {
  if (process.platform !== "win32") {
    return { ok: false, error: "Windows 서비스 제어는 이 플랫폼에서 지원되지 않습니다." };
  }

  try {
    await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `${POWERSHELL_VERB[action]} -Name $env:OPS_CONSOLE_SERVICE_NAME -ErrorAction Stop`,
      ],
      { env: { ...process.env, OPS_CONSOLE_SERVICE_NAME: serviceName } },
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
