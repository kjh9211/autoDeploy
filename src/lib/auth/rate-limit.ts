// Single-process in-memory limiter — Ops Console always runs as one pm2
// instance (docs/PLANNING.md §2), so this doesn't need a shared store.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000;

const attempts = new Map<string, { count: number; windowStart: number }>();

export function isRateLimited(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: Date.now() });
    return;
  }
  entry.count += 1;
}

export function clearAttempts(key: string): void {
  attempts.delete(key);
}
