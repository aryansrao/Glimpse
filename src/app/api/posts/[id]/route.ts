import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import {
  commentVotes,
  postComments,
  postLikes,
  postMedia,
  posts,
  users,
} from "@/db/schema";
import {
  getLikedPostIds,
  getPostMediaByPostId,
  postSelection,
  toPostView,
} from "@/lib/feed";

/** GET /api/posts/[id] — a single post. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  const { id } = await params;
  const [row] = await db
    .select({ ...postSelection, isPublic: users.isPublic })
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(eq(posts.id, id))
    .limit(1);
  if (!row || (!row.isPublic && session?.user?.id !== row.userId)) {
    return NextResponse.json({ error: "That post doesn't exist." }, { status: 404 });
  }

  const [likedPostIds, mediaByPostId] = await Promise.all([
    getLikedPostIds(session?.user?.id, [row.id]),
    getPostMediaByPostId([row.id]),
  ]);
  return NextResponse.json({
    post: toPostView(row, likedPostIds, mediaByPostId),
  });
}

/**
 * DELETE /api/posts/[id] — owner only; also purges likes, comments,
 * comment votes and media attachments.
 */
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
    .select({ id: posts.id, userId: posts.userId })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1);
  if (!post) {
    return NextResponse.json({ error: "That post doesn't exist." }, { status: 404 });
  }
  if (post.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the owner can delete a post." },
      { status: 403 }
    );
  }

  // Purge votes on this post's comments before the comments themselves.
  await db.delete(commentVotes).where(
    inArray(
      commentVotes.commentId,
      db
        .select({ id: postComments.id })
        .from(postComments)
        .where(eq(postComments.postId, id))
    )
  );
  await db.delete(postLikes).where(eq(postLikes.postId, id));
  await db.delete(postComments).where(eq(postComments.postId, id));
  await db.delete(postMedia).where(eq(postMedia.postId, id));
  await db.delete(posts).where(eq(posts.id, id));

  return NextResponse.json({ ok: true });
}
