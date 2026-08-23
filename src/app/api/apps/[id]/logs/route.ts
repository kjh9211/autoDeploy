import pm2 from "pm2";
import { prisma } from "@/lib/db/prisma";
import { getSessionUser } from "@/lib/auth/guard";
import { tailFile } from "@/lib/adapters/fileTail";

export const dynamic = "force-dynamic";

type LogPacket = { process?: { name?: string }; data?: unknown };

function sseEvent(text: string): string {
  // SSE data lines can't contain a raw newline, so a multi-line log entry
  // becomes multiple `data:` lines belonging to one event.
  return (
    text
      .split("\n")
      .map((line) => `data: ${line}`)
      .join("\n") + "\n\n"
  );
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/apps/[id]/logs">,
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  const app = await prisma.app.findUnique({ where: { id: Number(id) } });
  if (!app) return new Response("Not Found", { status: 404 });

  const encoder = new TextEncoder();
  const abort = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(text)));
        } catch {
          // controller already closed (client disconnected) — ignore
        }
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

      if (app.runtime === "pm2" && app.pm2Name) {
        const pm2Name = app.pm2Name;
        pm2.connect((connectErr) => {
          if (connectErr) {
            send(`[오류] PM2 연결 실패: ${connectErr.message}`);
            closeOnce();
            return;
          }
          pm2.launchBus((busErr, bus) => {
            if (busErr) {
              send(`[오류] 로그 스트림 연결 실패: ${busErr.message}`);
              pm2.disconnect();
              closeOnce();
              return;
            }
            const onLog = (packet: LogPacket) => {
              if (packet.process?.name === pm2Name) {
                send(String(packet.data ?? "").replace(/\n$/, ""));
              }
            };
            bus.on("log:out", onLog);
            bus.on("log:err", onLog);

            abort.signal.addEventListener("abort", () => {
              bus.off("log:out");
              bus.off("log:err");
              pm2.disconnect();
              closeOnce();
            });
          });
        });
      } else if (app.runtime === "nssm" && app.logPath) {
        const logPath = app.logPath;
        (async () => {
          try {
            for await (const line of tailFile(logPath, abort.signal)) {
              send(line);
            }
          } catch (err) {
            send(`[오류] ${err instanceof Error ? err.message : String(err)}`);
          } finally {
            closeOnce();
          }
        })();
      } else {
        send("[안내] 이 앱에는 로그 스트림 소스가 설정되어 있지 않습니다.");
        closeOnce();
      }
    },
    cancel() {
      abort.abort();
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
