import { NextResponse } from "next/server";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { confessionMessages, confessions } from "@/db/schema";

/**
 * The signed-in user's own received confessions, newest activity first.
 * Never exposes senderUserId — confessions stay anonymous to the recipient.
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
      createdAt: confessions.createdAt,
      lastMessageAt: confessions.lastMessageAt,
    })
    .from(confessions)
    .where(eq(confessions.toUserId, session.user.id))
    .orderBy(desc(sql`coalesce(${confessions.lastMessageAt}, ${confessions.createdAt})`))
    .limit(100);

  if (rows.length === 0) return NextResponse.json({ confessions: [] });

  const counts = await db
    .select({
      confessionId: confessionMessages.confessionId,
      replyCount: sql<number>`count(*)`,
    })
    .from(confessionMessages)
    .where(inArray(confessionMessages.confessionId, rows.map((r) => r.id)))
    .groupBy(confessionMessages.confessionId);
  const countById = new Map(counts.map((c) => [c.confessionId, c.replyCount]));

  return NextResponse.json({
    confessions: rows.map((r) => ({
      ...r,
      replyCount: countById.get(r.id) ?? 0,
    })),
  });
}
