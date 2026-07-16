import { NextResponse } from "next/server";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { commentVotes, postComments, posts, users } from "@/db/schema";
import { parseTimeCursor } from "@/lib/feed";
import { publicUserColumns } from "@/lib/social";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

/** Reddit-style nesting cap — see POST below. */
const MAX_DEPTH = 6;
/** Backstop when walking parent chains (legacy/corrupt data). */
const MAX_CHAIN_WALK = 32;

/**
 * GET /api/posts/[id]/comments?cursor=<epoch ms>&limit=100
 *
 * FLAT comment list, oldest-first (the UI builds the tree from
 * `parentId`). Default limit 100, cap 200. Each comment:
 * {id, parentId, body, score, myVote, createdAt, user} where `myVote`
 * is -1|0|1 for the session user (always 0 signed out). `nextCursor`
 * is the createdAt (epoch ms) of the last returned comment, or null at
 * the end.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  const { id } = await params;
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!post) {
    return NextResponse.json({ error: "That post doesn't exist." }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const cursor = parseTimeCursor(searchParams.get("cursor"));

  const filters = [eq(postComments.postId, id)];
  if (cursor) filters.push(gt(postComments.createdAt, cursor));

  const rows = await db
    .select({
      id: postComments.id,
      parentId: postComments.parentId,
      body: postComments.body,
      score: postComments.score,
      createdAt: postComments.createdAt,
      user: publicUserColumns,
    })
    .from(postComments)
    .innerJoin(users, eq(postComments.userId, users.id))
    .where(and(...filters))
    .orderBy(asc(postComments.createdAt))
    .limit(limit);

  // The session user's votes on this page — one query.
  const myVotes = new Map<string, number>();
  if (session?.user && rows.length > 0) {
    const voteRows = await db
      .select({ commentId: commentVotes.commentId, value: commentVotes.value })
      .from(commentVotes)
      .where(
        and(
          eq(commentVotes.userId, session.user.id),
          inArray(
            commentVotes.commentId,
            rows.map((r) => r.id)
          )
        )
      );
    for (const vote of voteRows) myVotes.set(vote.commentId, vote.value);
  }

  return NextResponse.json({
    comments: rows.map((row) => ({
      ...row,
      myVote: myVotes.get(row.id) ?? 0,
    })),
    nextCursor:
      rows.length === limit ? rows[rows.length - 1].createdAt.getTime() : null,
  });
}

const postSchema = z.object({
  body: z.string().trim().min(1).max(500),
  parentId: z.string().min(1).max(64).optional(),
});

/**
 * POST /api/posts/[id]/comments — add a comment or nested reply,
 * bumping commentCount.
 *
 * Optional `parentId` targets another comment on the SAME post (400
 * otherwise). Nesting is capped at 6 levels: replies to anything deeper
 * attach to the level-6 ancestor instead, so the stored parentId may
 * differ from the requested one — use the response's `parentId`.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });
  }

  const { id } = await params;
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!post) {
    return NextResponse.json({ error: "That post doesn't exist." }, { status: 404 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Comments must be 1-500 characters." },
      { status: 400 }
    );
  }

  // Resolve + validate the parent, clamping depth to MAX_DEPTH levels.
  let parentId: string | null = null;
  if (parsed.data.parentId) {
    const [parent] = await db
      .select({
        id: postComments.id,
        postId: postComments.postId,
        parentId: postComments.parentId,
      })
      .from(postComments)
      .where(eq(postComments.id, parsed.data.parentId))
      .limit(1);
    if (!parent || parent.postId !== id) {
      return NextResponse.json(
        { error: "That parent comment doesn't exist on this post." },
        { status: 400 }
      );
    }

    // Walk the parent chain up to the root: chain[0] = parent,
    // chain[chain.length - 1] = top-level ancestor (depth 1).
    const chain = [parent];
    while (chain[chain.length - 1].parentId && chain.length < MAX_CHAIN_WALK) {
      const [next] = await db
        .select({
          id: postComments.id,
          postId: postComments.postId,
          parentId: postComments.parentId,
        })
        .from(postComments)
        .where(eq(postComments.id, chain[chain.length - 1].parentId!))
        .limit(1);
      if (!next) break;
      chain.push(next);
    }

    // parent sits at depth chain.length; chain[k] at depth length - k.
    // Deeper replies attach to the level-6 ancestor.
    parentId = chain[Math.max(0, chain.length - MAX_DEPTH)].id;
  }

  const [me] = await db
    .select(publicUserColumns)
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!me) {
    return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });
  }

  const [comment] = await db
    .insert(postComments)
    .values({
      id: nanoid(),
      postId: id,
      userId: session.user.id,
      parentId,
      body: parsed.data.body,
    })
    .returning();

  await db
    .update(posts)
    .set({ commentCount: sql`${posts.commentCount} + 1` })
    .where(eq(posts.id, id));

  return NextResponse.json(
    {
      id: comment.id,
      parentId: comment.parentId,
      body: comment.body,
      score: comment.score,
      myVote: 0,
      createdAt: comment.createdAt,
      user: me,
    },
    { status: 201 }
  );
}
