import { and, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { roomMessages, users } from "@/db/schema";
import { resolveIdentity } from "@/lib/identity";
import { getMemberPermissions, getRoomBySlug } from "@/lib/chatroom";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return new Response("Room not found.", { status: 404 });

  const identity = await resolveIdentity();
  const { member } = await getMemberPermissions(room.id, identity.id);
  if (!member) return new Response("Not a member of this room.", { status: 403 });

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
          .from(roomMessages)
          .where(and(eq(roomMessages.roomId, room.id), gt(roomMessages.createdAt, since)));

        if (rows.length) {
          const userIds = [...new Set(rows.map((r) => r.userId))];
          const userRows = await db.select().from(users).where(inArray(users.id, userIds));
          const userById = new Map(userRows.map((u) => [u.id, u]));

          for (const m of rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
            send("message", {
              id: m.id,
              roomId: m.roomId,
              userId: m.userId,
              body: m.body,
              mediaUrl: m.mediaUrl,
              mediaType: m.mediaType,
              createdAt: m.createdAt,
              sender: {
                name: userById.get(m.userId)?.name ?? "Guest",
                avatarWebpBase64: userById.get(m.userId)?.avatarWebpBase64 ?? null,
              },
            });
            sinceMs = Math.max(sinceMs, m.createdAt.getTime());
          }
        } else {
          send("ping", {});
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
