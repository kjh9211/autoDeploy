import { readFile } from "node:fs/promises";

type DumpEntry = { name?: string; pm2_env?: { name?: string } };

export type DumpPm2SyncStatus =
  | {
      ok: true;
      inSync: boolean;
      onlyInDump: string[];
      onlyInLive: string[];
    }
  | { ok: false; error: string };

async function readDumpProcessNames(path: string): Promise<string[]> {
  const raw = await readFile(path, "utf-8");
  const entries = JSON.parse(raw) as DumpEntry[];
  return entries
    .map((e) => e.name ?? e.pm2_env?.name)
    .filter((name): name is string => !!name);
}

// Compares `pm2 save`'s dump.pm2 against the currently running process list —
// a mismatch means someone started/stopped something without saving, so a
// reboot or `pm2 resurrect` would not restore the current state.
// See docs/PLANNING.md §6.1.
export async function checkDumpPm2Sync(
  dumpPath: string,
  liveProcessNames: string[],
): Promise<DumpPm2SyncStatus> {
  try {
    const dumpNames = await readDumpProcessNames(dumpPath);
    const dumpSet = new Set(dumpNames);
    const liveSet = new Set(liveProcessNames);

    const onlyInDump = dumpNames.filter((n) => !liveSet.has(n));
    const onlyInLive = liveProcessNames.filter((n) => !dumpSet.has(n));

    return {
      ok: true,
      inSync: onlyInDump.length === 0 && onlyInLive.length === 0,
      onlyInDump,
      onlyInLive,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
