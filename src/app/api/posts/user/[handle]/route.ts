import { NextResponse } from "next/server";
import { and, desc, eq, lt } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { posts, users } from "@/db/schema";
import {
  getLikedPostIds,
  getPostMediaByPostId,
  parseTimeCursor,
  POST_PAGE_LIMIT,
  toPostView,
} from "@/lib/feed";
import { LIST_LIMIT } from "@/lib/social";

/**
 * GET /api/posts/user/[handle]?cursor=<epoch ms>&limit=20
 *
 * A user's posts, newest first. Time-cursor pagination: `nextCursor` is
 * the createdAt (epoch ms) of the last returned post, or null at the
 * end. Private accounts are only visible to themselves.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const session = await auth();

  const { handle } = await params;
  const [target] = await db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      avatarWebpBase64: users.avatarWebpBase64,
      isPublic: users.isPublic,
    })
    .from(users)
    .where(eq(users.handle, handle.trim().toLowerCase()))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "That user doesn't exist." }, { status: 404 });
  }
  if (!target.isPublic && session?.user?.id !== target.id) {
    return NextResponse.json({ error: "This account is private." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || POST_PAGE_LIMIT, 1),
    LIST_LIMIT
  );
  const cursor = parseTimeCursor(searchParams.get("cursor"));

  const filters = [eq(posts.userId, target.id)];
  if (cursor) filters.push(lt(posts.createdAt, cursor));

  const rows = await db
    .select()
    .from(posts)
    .where(and(...filters))
    .orderBy(desc(posts.createdAt))
    .limit(limit);

  const postIds = rows.map((p) => p.id);
  const [likedPostIds, mediaByPostId] = await Promise.all([
    getLikedPostIds(session?.user?.id, postIds),
    getPostMediaByPostId(postIds),
  ]);
  const user = {
    id: target.id,
    handle: target.handle,
    name: target.name,
    avatarWebpBase64: target.avatarWebpBase64,
  };

  return NextResponse.json({
    posts: rows.map((row) =>
      toPostView({ ...row, user }, likedPostIds, mediaByPostId)
    ),
    nextCursor:
      rows.length === limit ? rows[rows.length - 1].createdAt.getTime() : null,
  });
}
