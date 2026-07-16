import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upper = code.toUpperCase();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      let closed = false;
      const timeout = setTimeout(() => {
        closed = true;
        send("timeout", {});
        controller.close();
      }, 5 * 60 * 1000);

      while (!closed) {
        const [room] = await db.select().from(rooms).where(eq(rooms.code, upper));
        if (!room) {
          send("gone", {});
          break;
        }
        if (room.status === "occupied") {
          // Multi-participant rooms: "occupied" now just means at least one
          // person has joined; guestName is the most recent joiner. The host
          // page uses this single event to flip out of its waiting state.
          send("joined", { guestName: room.guestName });
          break;
        }
        if (room.status === "closed") {
          send("gone", {});
          break;
        }
        send("waiting", {});
        await new Promise((r) => setTimeout(r, 1500));
      }

      clearTimeout(timeout);
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
