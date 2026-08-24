import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { config } from "@/lib/config";

const execFileAsync = promisify(execFile);

export type ContainerStatus = {
  name: string;
  service: string;
  state: string; // e.g. "running", "exited"
  health: string | null; // "healthy" | "unhealthy" | "starting" | null (no healthcheck defined)
};

export type ContainerHealthResult =
  | { ok: true; containers: ContainerStatus[] }
  | { ok: false; error: string };

// docs/PLANNING.md §6.6 — shells out to `docker compose ps` in the mailcow
// stack's directory rather than talking to the Docker API directly, same
// reasoning as the NSSM adapter shelling out to PowerShell.
export async function getMailcowContainerHealth(): Promise<ContainerHealthResult> {
  if (!config.MAILCOW_COMPOSE_DIR) {
    return { ok: false, error: "MAILCOW_COMPOSE_DIR이 설정되어 있지 않습니다." };
  }
  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["compose", "ps", "--all", "--format", "json"],
      { cwd: config.MAILCOW_COMPOSE_DIR, timeout: 15_000 },
    );

    // Compose v2 prints one JSON object per line (JSON Lines), not a single array.
    const containers: ContainerStatus[] = stdout
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line))
      .map((c) => ({
        name: c.Name ?? c.Names ?? "?",
        service: c.Service ?? "?",
        state: c.State ?? "unknown",
        health: c.Health || null,
      }));

    return { ok: true, containers };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
