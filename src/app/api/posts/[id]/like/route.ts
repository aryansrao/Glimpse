import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auth } from "@/auth";
import { db } from "@/db";
import { postLikes, posts } from "@/db/schema";

/** POST /api/posts/[id]/like — idempotent like. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to like posts." }, { status: 401 });
  }

  const { id } = await params;
  const [post] = await db
    .select({ id: posts.id, likeCount: posts.likeCount })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!post) {
    return NextResponse.json({ error: "That post doesn't exist." }, { status: 404 });
  }

  const inserted = await db
    .insert(postLikes)
    .values({ id: nanoid(), postId: id, userId: session.user.id })
    .onConflictDoNothing()
    .returning();

  let likeCount = post.likeCount;
  if (inserted.length > 0) {
    // Only bump the counter when the insert actually happened, and do it
    // atomically so concurrent likes can't clobber each other.
    const [updated] = await db
      .update(posts)
      .set({ likeCount: sql`${posts.likeCount} + 1` })
      .where(eq(posts.id, id))
      .returning({ likeCount: posts.likeCount });
    likeCount = updated?.likeCount ?? likeCount + 1;
  }

  return NextResponse.json({ liked: true, likeCount });
}

/** DELETE /api/posts/[id]/like — idempotent unlike. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const [post] = await db
    .select({ id: posts.id, likeCount: posts.likeCount })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!post) {
    return NextResponse.json({ error: "That post doesn't exist." }, { status: 404 });
  }

  const deleted = await db
    .delete(postLikes)
    .where(and(eq(postLikes.postId, id), eq(postLikes.userId, session.user.id)))
    .returning();

  let likeCount = post.likeCount;
  if (deleted.length > 0) {
    const [updated] = await db
      .update(posts)
      .set({ likeCount: sql`MAX(${posts.likeCount} - 1, 0)` })
      .where(eq(posts.id, id))
      .returning({ likeCount: posts.likeCount });
    likeCount = updated?.likeCount ?? Math.max(likeCount - 1, 0);
  }

  return NextResponse.json({ liked: false, likeCount });
}
