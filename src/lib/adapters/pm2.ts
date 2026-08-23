import pm2 from "pm2";

export type Pm2ProcessStatus =
  | "online"
  | "stopping"
  | "stopped"
  | "launching"
  | "errored"
  | "one-launch-status"
  | "waiting_restart"
  | "unknown";

export type Pm2ProcessInfo = {
  name: string;
  pmId: number | null;
  status: Pm2ProcessStatus;
  cpu: number | null;
  memoryBytes: number | null;
  uptimeMs: number | null;
  restarts: number | null;
  execInterpreter: string | null;
  execPath: string | null;
  // Whether it follows docs/PLANNING.md §6.1: `--interpreter node` + a real
  // .js entry, rather than pm2 trying to run a Windows .cmd shim directly.
  followsWindowsConvention: boolean;
};

function connect(): Promise<void> {
  return new Promise((resolve, reject) => {
    pm2.connect((err) => (err ? reject(err) : resolve()));
  });
}

function disconnect(): void {
  pm2.disconnect();
}

function list(): Promise<pm2.ProcessDescription[]> {
  return new Promise((resolve, reject) => {
    pm2.list((err, list) => (err ? reject(err) : resolve(list)));
  });
}

function normalize(proc: pm2.ProcessDescription): Pm2ProcessInfo {
  const env = proc.pm2_env;
  const execInterpreter = env?.exec_interpreter ?? null;
  const execPath = env?.pm_exec_path ?? null;

  return {
    name: proc.name ?? "(unnamed)",
    pmId: proc.pm_id ?? null,
    status: (env?.status as Pm2ProcessStatus) ?? "unknown",
    cpu: proc.monit?.cpu ?? null,
    memoryBytes: proc.monit?.memory ?? null,
    uptimeMs: env?.pm_uptime ? Date.now() - env.pm_uptime : null,
    restarts: env?.restart_time ?? null,
    execInterpreter,
    execPath,
    followsWindowsConvention:
      execInterpreter === "node" && !!execPath?.endsWith(".js"),
  };
}

export type Pm2ListResult =
  | { ok: true; processes: Pm2ProcessInfo[] }
  | { ok: false; error: string };

// PM2's IPC connect will spawn/launch a daemon if one isn't already running,
// so on a dev machine with no daemon this creates one rather than failing —
// that's a real (harmless) side effect worth knowing about when testing.
export async function listPm2Processes(): Promise<Pm2ListResult> {
  try {
    await connect();
    const processes = await list();
    return { ok: true, processes: processes.map(normalize) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    disconnect();
  }
}

export async function findPm2Process(
  name: string,
): Promise<Pm2ProcessInfo | null> {
  const result = await listPm2Processes();
  if (!result.ok) return null;
  return result.processes.find((p) => p.name === name) ?? null;
}

export type Pm2Action = "start" | "stop" | "restart";

export type Pm2ControlResult = { ok: true } | { ok: false; error: string };

// Phase 1 control action (docs/PLANNING.md §9) — every call is written to
// the audit log by the caller, never invoked silently.
export async function controlPm2Process(
  name: string,
  action: Pm2Action,
): Promise<Pm2ControlResult> {
  try {
    await connect();
    await new Promise<void>((resolve, reject) => {
      const cb = (err: Error | null) => (err ? reject(err) : resolve());
      if (action === "start") pm2.start(name, cb);
      else if (action === "stop") pm2.stop(name, cb);
      else pm2.restart(name, cb);
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    disconnect();
  }
}
