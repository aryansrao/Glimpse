import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmMessages, dmThreads, rooms, users } from "@/db/schema";
import { generateRoomCode, ROOM_TTL_MS } from "@/lib/room-code";
import { absoluteUrl } from "@/lib/site";

const schema = z.object({
  userId: z.string().min(1),
  mode: z.enum(["video", "audio"]).default("video"),
});

/**
 * Creates a private room hosted by the session user and DMs the target a
 * rejoin invite ("Rejoin me? <site>/room/<code>?join=1"). Returns
 * { code, hostToken, mode } so the caller can enter the room as host.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const me = session.user.id;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { userId: targetId, mode } = parsed.data;
  if (targetId === me) {
    return NextResponse.json({ error: "You can't rejoin yourself." }, { status: 400 });
  }

  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, targetId)).limit(1);
  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Create the private room the same way POST /api/rooms does.
  const hostPeerId = `glimpse-room-${nanoid(12)}`;
  const hostToken = nanoid(24);
  let code = generateRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const [clash] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!clash) break;
    code = generateRoomCode();
  }

  await db.insert(rooms).values({
    code,
    mode,
    hostToken,
    hostPeerId,
    hostName: session.user.name ?? "Member",
    hostUserId: me,
    status: "waiting",
    expiresAt: new Date(Date.now() + ROOM_TTL_MS),
  });

  // DM the invite — thread pair key is the lexicographically sorted id pair.
  const [a, b] = [me, targetId].sort();
  const now = new Date();
  let [thread] = await db
    .select()
    .from(dmThreads)
    .where(and(eq(dmThreads.userAId, a), eq(dmThreads.userBId, b)))
    .limit(1);
  if (!thread) {
    [thread] = await db
      .insert(dmThreads)
      .values({ id: nanoid(), userAId: a, userBId: b, lastMessageAt: now })
      .returning();
  }

  await db.insert(dmMessages).values({
    id: nanoid(),
    threadId: thread.id,
    senderId: me,
    body: `Rejoin me? ${absoluteUrl(`/room/${code}?join=1`)}`,
  });
  await db.update(dmThreads).set({ lastMessageAt: now }).where(eq(dmThreads.id, thread.id));

  return NextResponse.json({ code, hostToken, mode });
}
