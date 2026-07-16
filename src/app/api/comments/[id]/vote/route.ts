import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { commentVotes, postComments } from "@/db/schema";

const schema = z.object({
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

/**
 * POST /api/comments/[id]/vote — Reddit-style comment voting.
 *
 * Body {value: 1|-1|0}; 0 removes the session user's vote. Upserts the
 * commentVotes row and applies the score delta (new - previous)
 * atomically to the denormalized postComments.score. Returns
 * {score, myVote}.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
  }

  const { id } = await params;
  const [comment] = await db
    .select({ id: postComments.id, score: postComments.score })
    .from(postComments)
    .where(eq(postComments.id, id))
    .limit(1);
  if (!comment) {
    return NextResponse.json(
      { error: "That comment doesn't exist." },
      { status: 404 }
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Vote value must be 1, -1 or 0." },
      { status: 400 }
    );
  }
  const value = parsed.data.value;

  const pairFilter = and(
    eq(commentVotes.commentId, id),
    eq(commentVotes.userId, session.user.id)
  );
  const [existing] = await db
    .select({ value: commentVotes.value })
    .from(commentVotes)
    .where(pairFilter)
    .limit(1);
  const previous = existing?.value ?? 0;

  if (value === 0) {
    await db.delete(commentVotes).where(pairFilter);
  } else {
    await db
      .insert(commentVotes)
      .values({ id: nanoid(), commentId: id, userId: session.user.id, value })
      .onConflictDoUpdate({
        target: [commentVotes.commentId, commentVotes.userId],
        set: { value },
      });
  }

  const delta = value - previous;
  let score = comment.score;
  if (delta !== 0) {
    const [updated] = await db
      .update(postComments)
      .set({ score: sql`${postComments.score} + ${delta}` })
      .where(eq(postComments.id, id))
      .returning({ score: postComments.score });
    score = updated?.score ?? score + delta;
  }

  return NextResponse.json({ score, myVote: value });
}
