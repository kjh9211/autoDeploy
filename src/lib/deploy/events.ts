import { EventEmitter } from "node:events";

// In-memory pub/sub, keyed by DeployLog id — fine because Ops Console runs
// as a single pm2 instance (same assumption as src/lib/auth/rate-limit.ts).
// The DB row (stepsJson) is the durable record; this is only for pushing
// live updates to a browser that's currently watching. A viewer that opens
// the page after the emitter is gone just sees the persisted final state.

export type DeployEvent =
  | { type: "step-start"; step: string }
  | { type: "output"; step: string; chunk: string }
  | { type: "step-end"; step: string; status: "success" | "failed" | "skipped" }
  | { type: "done"; status: "success" | "failed" };

const emitters = new Map<number, EventEmitter>();

export function getDeployEmitter(deployLogId: number): EventEmitter {
  let emitter = emitters.get(deployLogId);
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(20);
    emitters.set(deployLogId, emitter);
  }
  return emitter;
}

export function emitDeployEvent(deployLogId: number, event: DeployEvent): void {
  getDeployEmitter(deployLogId).emit("event", event);
}

export function cleanupDeployEmitter(deployLogId: number): void {
  emitters.get(deployLogId)?.removeAllListeners();
  emitters.delete(deployLogId);
}
