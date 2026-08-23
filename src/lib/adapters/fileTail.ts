import { open, stat } from "node:fs/promises";

const POLL_INTERVAL_MS = 1000;

// Polling tail (not fs.watch) — predictable across the Windows/NSSM log
// files this is built for, and simple enough to reason about for an ops
// dashboard where sub-second latency doesn't matter.
export async function* tailFile(
  path: string,
  signal: AbortSignal,
): AsyncGenerator<string> {
  let position: number;
  try {
    position = (await stat(path)).size;
  } catch (err) {
    throw new Error(
      `로그 파일을 열 수 없습니다: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  while (!signal.aborted) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    if (signal.aborted) return;

    let size: number;
    try {
      size = (await stat(path)).size;
    } catch {
      continue; // file momentarily missing (rotation) — keep waiting
    }

    if (size < position) {
      position = 0; // truncated or rotated — restart from the top
    }
    if (size === position) continue;

    const handle = await open(path, "r");
    try {
      const buffer = Buffer.alloc(size - position);
      await handle.read(buffer, 0, buffer.length, position);
      position = size;
      const text = buffer.toString("utf-8");
      for (const line of text.split(/\r?\n/)) {
        if (line.length > 0) yield line;
      }
    } finally {
      await handle.close();
    }
  }
}
