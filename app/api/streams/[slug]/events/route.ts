import { NextRequest } from "next/server";
import { ApiError, fail, findStream } from "@/lib/api";
import { chatSnapshot } from "@/lib/community";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const channel = await findStream(slug);
    const scope =
      request.nextUrl.searchParams.get("scope") === "staff"
        ? "staff"
        : "public";
    const initial = await chatSnapshot(request, channel, scope);
    const encoder = new TextEncoder();
    let cleanup = () => {};
    const stream = new ReadableStream({
      start(controller) {
        let closed = false,
          pending = false,
          previous = JSON.stringify(initial);
        const send = (event: string, value: string) =>
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${value}\n\n`),
          );
        controller.enqueue(encoder.encode("retry: 1500\n\n"));
        send("messages", previous);
        const timer = setInterval(async () => {
          if (pending || closed) return;
          pending = true;
          try {
            const current = await findStream(slug);
            const value = JSON.stringify(
              await chatSnapshot(request, current, scope),
            );
            if (!closed) {
              if (value !== previous) {
                send("messages", value);
                previous = value;
              } else controller.enqueue(encoder.encode(": keepalive\n\n"));
            }
          } catch (error) {
            if (!closed) {
              if (
                error instanceof ApiError &&
                [401, 403, 404].includes(error.status)
              )
                send("denied", JSON.stringify(error.message));
              cleanup();
            }
          } finally {
            pending = false;
          }
        }, 1500);
        const lifetime = setTimeout(() => cleanup(), 25000);
        cleanup = () => {
          if (closed) return;
          closed = true;
          clearInterval(timer);
          clearTimeout(lifetime);
          request.signal.removeEventListener("abort", cleanup);
          try {
            controller.close();
          } catch {
            /* Consumer already cancelled. */
          }
        };
        request.signal.addEventListener("abort", cleanup, { once: true });
        if (request.signal.aborted) cleanup();
      },
      cancel() {
        cleanup();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
