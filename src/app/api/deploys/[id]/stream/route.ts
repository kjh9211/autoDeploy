import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/guard";
import { getDeployEmitter, type DeployEvent } from "@/lib/deploy/events";
import type { DeployStepRecord } from "@/lib/deploy/pipeline";

export const dynamic = "force-dynamic";

function sseEvent(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/deploys/[id]/stream">,
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const deployLogId = Number(id);
  const deployLog = await prisma.deployLog.findUnique({ where: { id: deployLogId } });
  if (!deployLog) return new Response("Not Found", { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(data)));
        } catch {}
      };
      const closeOnce = (() => {
        let closed = false;
        return () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {}
        };
      })();

      // Replay whatever's already recorded — covers both a finished deploy
      // and a client that opens the stream mid-run (emitter events only
      // fire going forward, so without this replay any steps that finished
      // before this connection opened would never show up).
      const steps = JSON.parse(deployLog.stepsJson) as DeployStepRecord[];
      for (const s of steps) {
        send({ type: "step-start", step: s.name });
        if (s.output) send({ type: "output", step: s.name, chunk: s.output });
        send({ type: "step-end", step: s.name, status: s.status });
      }

      if (deployLog.status !== "running") {
        send({ type: "done", status: deployLog.status });
        closeOnce();
        return;
      }

      const emitter = getDeployEmitter(deployLogId);
      const onEvent = (event: DeployEvent) => {
        send(event);
        if (event.type === "done") closeOnce();
      };
      emitter.on("event", onEvent);
      unsubscribe = () => emitter.off("event", onEvent);

      // The pipeline may have finished between our first DB read and
      // subscribing above — in which case its "done" event already fired
      // and cleaned up before we were listening. Re-check and close.
      const recheck = await prisma.deployLog.findUnique({ where: { id: deployLogId } });
      if (recheck && recheck.status !== "running") {
        send({ type: "done", status: recheck.status });
        closeOnce();
      }
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
