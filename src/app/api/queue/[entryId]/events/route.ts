import { pollQueue, roomNameForEntry } from "@/lib/matchmaking";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;

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
        const entry = await pollQueue(entryId);
        if (!entry) {
          send("gone", {});
          break;
        }
        // Group matches are written in two steps; wait for the member list
        // (matchedWithName) before announcing so the payload is complete.
        const groupReady = entry.groupSize <= 2 || !!entry.matchedWithName;
        if (entry.status === "matched" && entry.matchedWithPeerId && groupReady) {
          send("matched", {
            partnerPeerId: entry.matchedWithPeerId,
            partnerName: entry.matchedWithName,
            isInitiator: entry.isInitiator,
            roomName: roomNameForEntry(entry),
            groupSize: entry.groupSize,
          });
          break;
        }
        if (entry.status === "cancelled") {
          send("cancelled", {});
          break;
        }
        send("waiting", {});
        await new Promise((r) => setTimeout(r, 1200));
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
