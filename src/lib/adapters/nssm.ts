import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type WindowsServiceStatus =
  | { ok: true; status: string }
  | { ok: false; supported: false; error: string }
  | { ok: false; supported: true; error: string };

// Phase 0 is read-only (docs/PLANNING.md §9) — start/stop/restart land in
// Phase 1, once docs/PLANNING.md §6.7's execution-account decision is made.
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
