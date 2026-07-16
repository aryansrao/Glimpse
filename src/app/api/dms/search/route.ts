import { NextResponse } from "next/server";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmMessages, dmThreads, follows, users } from "@/db/schema";
import { publicUserColumns } from "@/lib/social";

const RESULT_CAP = 20;
const SNIPPET_LEN = 140;

/** Trim a matched message body down to a readable snippet around the hit. */
function snippet(body: string, q: string): string {
  if (body.length <= SNIPPET_LEN) return body;
  const at = body.toLowerCase().indexOf(q.toLowerCase());
  if (at <= 30) return `${body.slice(0, SNIPPET_LEN)}…`;
  const start = Math.max(0, at - 40);
  return `…${body.slice(start, start + SNIPPET_LEN)}…`;
}

/**
 * DM search: `people` = users I already talk to or follow whose name or
 * handle matches; `messages` = LIKE hits across my threads' messages.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const me = session.user.id;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ people: [], messages: [] });
  // Escape LIKE wildcards so "50%" doesn't match everything.
  const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
  const pattern = `%${escaped}%`;

  const [threadRows, followRows] = await Promise.all([
    db
      .select()
      .from(dmThreads)
      .where(or(eq(dmThreads.userAId, me), eq(dmThreads.userBId, me))),
    db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, me)),
  ]);

  const threadByOtherId = new Map(
    threadRows.map((t) => [t.userAId === me ? t.userBId : t.userAId, t.id])
  );
  const candidateIds = new Set<string>([
    ...threadByOtherId.keys(),
    ...followRows.map((f) => f.followingId),
  ]);
  candidateIds.delete(me);

  const myThreadIds = threadRows.map((t) => t.id);

  const [peopleRows, messageRows] = await Promise.all([
    candidateIds.size
      ? db
          .select(publicUserColumns)
          .from(users)
          .where(
            and(
              inArray(users.id, [...candidateIds]),
              or(
                sql`${users.name} LIKE ${pattern} ESCAPE '\'`,
                sql`${users.handle} LIKE ${pattern} ESCAPE '\'`
              )
            )
          )
          .limit(RESULT_CAP)
      : Promise.resolve([]),
    myThreadIds.length
      ? db
          .select({
            id: dmMessages.id,
            threadId: dmMessages.threadId,
            senderId: dmMessages.senderId,
            body: dmMessages.body,
            createdAt: dmMessages.createdAt,
          })
          .from(dmMessages)
          .where(
            and(
              inArray(dmMessages.threadId, myThreadIds),
              sql`${dmMessages.body} LIKE ${pattern} ESCAPE '\'`
            )
          )
          .orderBy(desc(dmMessages.createdAt))
          .limit(RESULT_CAP)
      : Promise.resolve([]),
  ]);

  // Resolve the "other user" for each message hit.
  const threadById = new Map(threadRows.map((t) => [t.id, t]));
  const otherIdsNeeded = new Set<string>();
  for (const m of messageRows) {
    const t = threadById.get(m.threadId);
    if (t) otherIdsNeeded.add(t.userAId === me ? t.userBId : t.userAId);
  }
  const otherUsers = otherIdsNeeded.size
    ? await db
        .select(publicUserColumns)
        .from(users)
        .where(inArray(users.id, [...otherIdsNeeded]))
    : [];
  const userById = new Map(otherUsers.map((u) => [u.id, u]));

  const people = peopleRows.map((u) => ({
    ...u,
    threadId: threadByOtherId.get(u.id) ?? null,
  }));

  const messages = messageRows.flatMap((m) => {
    const t = threadById.get(m.threadId);
    if (!t) return [];
    const otherUser = userById.get(t.userAId === me ? t.userBId : t.userAId);
    if (!otherUser || !m.body) return [];
    return [
      {
        threadId: m.threadId,
        messageId: m.id,
        body: snippet(m.body, q),
        otherUser,
        createdAt: m.createdAt,
      },
    ];
  });

  return NextResponse.json({ people, messages });
}
