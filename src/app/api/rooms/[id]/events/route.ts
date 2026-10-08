import { getEvents, getTyping, normalizeRoomId, roomExists } from "@/lib/rooms";
import { kv } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Close before the platform does, so the stream always ends cleanly. */
const LIFETIME_MS = 240_000;
const PING_MS = 15_000;

/**
 * The room's event log as Server-Sent Events. Each event's id is its
 * position in the log, so when the connection drops (or this function
 * reaches its time limit) the browser's EventSource reconnects with
 * `Last-Event-ID` and the stream resumes exactly where it stopped.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = normalizeRoomId((await params).id);
  if (!id || !(await roomExists(id))) return Response.json({ error: "not_found" }, { status: 404 });

  const last = request.headers.get("last-event-id");
  let cursor = last !== null && /^\d+$/.test(last) ? Number(last) + 1 : 0;
  // The memory store costs nothing to poll; Upstash bills per command.
  const interval = kv().kind === "memory" ? 200 : 600;
  // Who is typing is read less often than the log (about once a second), and sent only when it changes.
  const typingEvery = kv().kind === "memory" ? 5 : 2;
  const encoder = new TextEncoder();
  const { signal } = request;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));
      const started = Date.now();
      let lastWrite = started;
      let idleTicks = 0;
      let announced = false;
      let ticks = 0;
      let typing = "";
      try {
        send("retry: 1000\n\n");
        while (!signal.aborted && Date.now() - started < LIFETIME_MS) {
          const events = await getEvents(id, cursor);
          for (const event of events) {
            send(`id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`);
            cursor = event.seq + 1;
          }
          if (events.length > 0) lastWrite = Date.now();
          if (!announced) {
            // Tells the browser the replay of past events is over.
            send(`event: ready\ndata: ${cursor}\n\n`);
            announced = true;
          }
          if (ticks++ % typingEvery === 0) {
            const now = JSON.stringify(await getTyping(id));
            if (now !== typing) {
              send(`event: typing\ndata: ${now}\n\n`);
              typing = now;
              lastWrite = Date.now();
            }
          }
          if (events.length === 0) {
            idleTicks += 1;
            if (idleTicks % 25 === 0 && !(await roomExists(id))) {
              send("event: gone\ndata: {}\n\n");
              break;
            }
            if (Date.now() - lastWrite > PING_MS) {
              send(": ping\n\n");
              lastWrite = Date.now();
            }
          }
          await new Promise((resolve) => setTimeout(resolve, interval));
        }
      } catch {
        // The client went away mid-write; nothing to clean up.
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by the abort.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
