import { NextResponse } from "next/server";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { confessionMessages, confessions, users } from "@/db/schema";
import { publicUserColumns } from "@/lib/social";

/**
 * Confessions the signed-in user sent while signed in. The recipient
 * never learns the sender; here the sender sees their own trail —
 * "You (anonymous) → @handle".
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const rows = await db
    .select({
      id: confessions.id,
      body: confessions.body,
      toUserId: confessions.toUserId,
      createdAt: confessions.createdAt,
      lastMessageAt: confessions.lastMessageAt,
    })
    .from(confessions)
    .where(eq(confessions.senderUserId, session.user.id))
    .orderBy(
      desc(sql`coalesce(${confessions.lastMessageAt}, ${confessions.createdAt})`)
    )
    .limit(100);

  if (rows.length === 0) return NextResponse.json({ confessions: [] });

  const [recipients, counts] = await Promise.all([
    db
      .select(publicUserColumns)
      .from(users)
      .where(inArray(users.id, [...new Set(rows.map((r) => r.toUserId))])),
    db
      .select({
        confessionId: confessionMessages.confessionId,
        replyCount: sql<number>`count(*)`,
      })
      .from(confessionMessages)
      .where(inArray(confessionMessages.confessionId, rows.map((r) => r.id)))
      .groupBy(confessionMessages.confessionId),
  ]);
  const userById = new Map(recipients.map((u) => [u.id, u]));
  const countById = new Map(counts.map((c) => [c.confessionId, c.replyCount]));

  return NextResponse.json({
    confessions: rows.flatMap((r) => {
      const toUser = userById.get(r.toUserId);
      if (!toUser) return [];
      return [
        {
          id: r.id,
          body: r.body,
          createdAt: r.createdAt,
          lastMessageAt: r.lastMessageAt,
          replyCount: countById.get(r.id) ?? 0,
          toUser,
        },
      ];
    }),
  });
}
