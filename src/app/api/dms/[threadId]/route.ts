import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmMessages, dmReactions, dmThreads, users } from "@/db/schema";
import { getDmThread, isThreadMember, publicUserColumns } from "@/lib/social";

/** Thread metadata for the conversation header + request banner. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { threadId } = await params;
  const thread = await getDmThread(threadId);
  if (!thread) {
    return NextResponse.json({ error: "That conversation doesn't exist." }, { status: 404 });
  }
  if (!isThreadMember(thread, session.user.id)) {
    return NextResponse.json({ error: "Not your conversation." }, { status: 403 });
  }

  const me = session.user.id;
  const otherUserId = thread.userAId === me ? thread.userBId : thread.userAId;
  const [otherUser] = await db
    .select(publicUserColumns)
    .from(users)
    .where(eq(users.id, otherUserId))
    .limit(1);

  return NextResponse.json({
    threadId: thread.id,
    state: thread.state,
    otherUserId,
    otherUser: otherUser ?? null,
    /** I sent a request the other side hasn't accepted yet. */
    pendingApproval: thread.state === "request" && thread.initiatorId === me,
    /** The other side sent me a request I can accept or decline. */
    requestForMe:
      thread.state === "request" && !!thread.initiatorId && thread.initiatorId !== me,
  });
}

/**
 * Delete a conversation — messages, reactions and the thread itself.
 * Either member may do this; it doubles as "decline request".
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { threadId } = await params;
  const thread = await getDmThread(threadId);
  if (!thread) {
    return NextResponse.json({ error: "That conversation doesn't exist." }, { status: 404 });
  }
  if (!isThreadMember(thread, session.user.id)) {
    return NextResponse.json({ error: "Not your conversation." }, { status: 403 });
  }

  await db.delete(dmReactions).where(
    inArray(
      dmReactions.messageId,
      db.select({ id: dmMessages.id }).from(dmMessages).where(eq(dmMessages.threadId, threadId))
    )
  );
  await db.delete(dmMessages).where(eq(dmMessages.threadId, threadId));
  await db.delete(dmThreads).where(eq(dmThreads.id, threadId));

  return NextResponse.json({ ok: true });
}
