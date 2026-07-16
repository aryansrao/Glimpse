import { NextResponse } from "next/server";
import { desc, eq, inArray, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmMessages, dmThreads, users } from "@/db/schema";
import { LIST_LIMIT, publicUserColumns } from "@/lib/social";

/**
 * Inbox listing. `?state=accepted` (default) returns normal chats plus
 * the caller's own outgoing pending requests (marked `pendingApproval`);
 * `?state=request` returns incoming message requests awaiting a decision.
 * Every response carries `requestCount` for the Requests tab badge.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to see your messages." }, { status: 401 });
  }
  const me = session.user.id;

  const { searchParams } = new URL(req.url);
  const stateFilter = searchParams.get("state") === "request" ? "request" : "accepted";

  const allRows = await db
    .select()
    .from(dmThreads)
    .where(or(eq(dmThreads.userAId, me), eq(dmThreads.userBId, me)))
    .orderBy(desc(dmThreads.lastMessageAt))
    .limit(LIST_LIMIT * 2);

  const isIncomingRequest = (t: (typeof allRows)[number]) =>
    t.state === "request" && !!t.initiatorId && t.initiatorId !== me;

  const requestCount = allRows.filter(isIncomingRequest).length;

  const threadRows = allRows
    .filter((t) => (stateFilter === "request" ? isIncomingRequest(t) : !isIncomingRequest(t)))
    .slice(0, LIST_LIMIT);

  if (threadRows.length === 0) {
    return NextResponse.json({ threads: [], requestCount });
  }

  const otherIds = threadRows.map((t) => (t.userAId === me ? t.userBId : t.userAId));
  const [userRows, lastMessages] = await Promise.all([
    db
      .select(publicUserColumns)
      .from(users)
      .where(inArray(users.id, [...new Set(otherIds)])),
    Promise.all(
      threadRows.map(async (t) => {
        const [last] = await db
          .select()
          .from(dmMessages)
          .where(eq(dmMessages.threadId, t.id))
          .orderBy(desc(dmMessages.createdAt))
          .limit(1);
        return last ?? null;
      })
    ),
  ]);
  const userById = new Map(userRows.map((u) => [u.id, u]));

  const threads = threadRows.flatMap((t, i) => {
    const otherUserId = t.userAId === me ? t.userBId : t.userAId;
    const otherUser = userById.get(otherUserId);
    if (!otherUser) return [];
    const last = lastMessages[i];
    return [
      {
        threadId: t.id,
        otherUserId,
        otherUser,
        state: t.state,
        pendingApproval: t.state === "request" && t.initiatorId === me,
        lastMessage: last
          ? {
              body: last.body,
              mediaType: last.mediaType,
              senderId: last.senderId,
              createdAt: last.createdAt,
            }
          : null,
      },
    ];
  });

  return NextResponse.json({ threads, requestCount });
}
