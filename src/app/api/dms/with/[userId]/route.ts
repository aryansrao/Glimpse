import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmMessages, dmThreads, follows, users } from "@/db/schema";
import { sortedPair } from "@/lib/social";

const schema = z.object({
  body: z.string().trim().max(2000).optional(),
});

/**
 * Open (or lazily create) the DM thread with a user. New threads record
 * the session user as initiator; if the recipient doesn't follow the
 * sender the thread starts in the "request" state and sits in the
 * recipient's Requests tab until accepted.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to send messages." }, { status: 401 });
  }
  const me = session.user.id;

  const { userId } = await params;
  if (userId === me) {
    return NextResponse.json({ error: "You can't message yourself." }, { status: 400 });
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "That user doesn't exist." }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Message is too long (max 2000)." }, { status: 400 });
  }

  const [userAId, userBId] = sortedPair(me, userId);
  const pairFilter = and(eq(dmThreads.userAId, userAId), eq(dmThreads.userBId, userBId));

  let [thread] = await db.select().from(dmThreads).where(pairFilter).limit(1);

  if (!thread) {
    // Recipient follows sender → normal chat; otherwise a request.
    const [followBack] = await db
      .select({ id: follows.id })
      .from(follows)
      .where(and(eq(follows.followerId, userId), eq(follows.followingId, me)))
      .limit(1);

    const [created] = await db
      .insert(dmThreads)
      .values({
        id: nanoid(),
        userAId,
        userBId,
        state: followBack ? "accepted" : "request",
        initiatorId: me,
      })
      .onConflictDoNothing()
      .returning();

    if (created) {
      thread = created;
    } else {
      // Lost a creation race — the other insert won, so read it back.
      [thread] = await db.select().from(dmThreads).where(pairFilter).limit(1);
    }
  }

  if (parsed.data.body) {
    const now = new Date();
    await db.insert(dmMessages).values({
      id: nanoid(),
      threadId: thread.id,
      senderId: me,
      body: parsed.data.body,
      createdAt: now,
    });
    const patch: { lastMessageAt: Date; state?: "accepted" } = { lastMessageAt: now };
    // The recipient replying to a request accepts it implicitly.
    if (thread.state === "request" && thread.initiatorId && thread.initiatorId !== me) {
      patch.state = "accepted";
      thread = { ...thread, state: "accepted" };
    }
    await db.update(dmThreads).set(patch).where(eq(dmThreads.id, thread.id));
  }

  return NextResponse.json({
    threadId: thread.id,
    state: thread.state,
    /** true when the session user started a request the other side hasn't accepted. */
    pendingApproval: thread.state === "request" && thread.initiatorId === me,
  });
}
