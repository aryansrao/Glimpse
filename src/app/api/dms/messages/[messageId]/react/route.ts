import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmMessages, dmReactions } from "@/db/schema";
import { getDmThread, isThreadMember } from "@/lib/social";

const schema = z.object({
  emoji: z.string().min(1).max(8),
  remove: z.boolean().optional(),
});

/**
 * Toggle the caller's emoji reaction on a DM message (one per user —
 * reacting again swaps the emoji, `remove: true` clears it).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const me = session.user.id;

  const { messageId } = await params;
  const [message] = await db
    .select({ id: dmMessages.id, threadId: dmMessages.threadId })
    .from(dmMessages)
    .where(eq(dmMessages.id, messageId))
    .limit(1);
  if (!message) {
    return NextResponse.json({ error: "That message doesn't exist." }, { status: 404 });
  }

  const thread = await getDmThread(message.threadId);
  if (!thread || !isThreadMember(thread, me)) {
    return NextResponse.json({ error: "Not your conversation." }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reaction." }, { status: 400 });
  }

  if (parsed.data.remove) {
    await db
      .delete(dmReactions)
      .where(and(eq(dmReactions.messageId, messageId), eq(dmReactions.userId, me)));
  } else {
    await db
      .insert(dmReactions)
      .values({ id: nanoid(), messageId, userId: me, emoji: parsed.data.emoji })
      .onConflictDoUpdate({
        target: [dmReactions.messageId, dmReactions.userId],
        set: { emoji: parsed.data.emoji },
      });
  }

  const reactions = await db
    .select({ emoji: dmReactions.emoji, userId: dmReactions.userId })
    .from(dmReactions)
    .where(eq(dmReactions.messageId, messageId));

  return NextResponse.json({ reactions });
}
