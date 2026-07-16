import { and, eq, gt } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmMessages } from "@/db/schema";
import { getDmThread, isThreadMember } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth();
  if (!session?.user) return new Response("Sign in required.", { status: 401 });

  const { threadId } = await params;
  const thread = await getDmThread(threadId);
  if (!thread) return new Response("Thread not found.", { status: 404 });
  if (!isThreadMember(thread, session.user.id)) {
    return new Response("Not your conversation.", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  let sinceMs = Number(searchParams.get("since")) || Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      let closed = false;
      const abort = () => {
        closed = true;
      };
      req.signal.addEventListener("abort", abort);

      const timeout = setTimeout(() => {
        closed = true;
      }, 5 * 60 * 1000);

      while (!closed) {
        const since = new Date(sinceMs);
        const rows = await db
          .select()
          .from(dmMessages)
          .where(and(eq(dmMessages.threadId, threadId), gt(dmMessages.createdAt, since)));

        if (rows.length) {
          for (const m of rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
            send("message", {
              id: m.id,
              threadId: m.threadId,
              senderId: m.senderId,
              body: m.body,
              mediaUrl: m.mediaUrl,
              mediaType: m.mediaType,
              replyToId: m.replyToId,
              createdAt: m.createdAt,
            });
            sinceMs = Math.max(sinceMs, m.createdAt.getTime());
          }
        } else {
          // Heartbeat comment keeps proxies from buffering/closing the stream.
          controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
        }

        await new Promise((r) => setTimeout(r, 1500));
      }

      clearTimeout(timeout);
      req.signal.removeEventListener("abort", abort);
      try {
        controller.close();
      } catch {
        // already closed
      }
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
