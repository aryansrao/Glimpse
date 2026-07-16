import { NextResponse } from "next/server";
import { desc, eq, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { follows, posts, users } from "@/db/schema";
import {
  FEED_CANDIDATE_POOL,
  getLikedPostIds,
  getPostMediaByPostId,
  POST_PAGE_LIMIT,
  rankPosts,
  toPostView,
  postSelection,
  type FeedViewer,
} from "@/lib/feed";
import { LIST_LIMIT, parseTags } from "@/lib/social";

/**
 * GET /api/posts/feed?cursor=<offset>&limit=20
 *
 * Ranked home feed. NOTE: because pages are slices of a ranked
 * candidate list (last 200 posts, scored in JS — see rankPosts in
 * lib/feed.ts), `cursor` here is a plain OFFSET INTEGER into the ranked
 * list, not a timestamp. Pass back `nextCursor` verbatim; null means
 * the end. Works signed out with reduced signals (engagement + recency).
 */
export async function GET(req: Request) {
  const session = await auth();

  const { searchParams } = new URL(req.url);
  const rawCursor = Number(searchParams.get("cursor"));
  const cursor = Number.isFinite(rawCursor) ? Math.max(0, Math.floor(rawCursor)) : 0;
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || POST_PAGE_LIMIT, 1),
    LIST_LIMIT
  );

  let viewer: FeedViewer = null;
  if (session?.user) {
    const [meRows, followRows] = await Promise.all([
      db
        .select({ tags: users.tags })
        .from(users)
        .where(eq(users.id, session.user.id))
        .limit(1),
      db
        .select({ followingId: follows.followingId })
        .from(follows)
        .where(eq(follows.followerId, session.user.id)),
    ]);
    viewer = {
      tags: parseTags(meRows[0]?.tags),
      followedUserIds: new Set(followRows.map((r) => r.followingId)),
    };
  }

  // Candidate pool: the most recent posts from public accounts (plus the
  // viewer's own), ranked in JS.
  const rows = await db
    .select(postSelection)
    .from(posts)
    .innerJoin(users, eq(posts.userId, users.id))
    .where(
      session?.user
        ? or(eq(users.isPublic, true), eq(posts.userId, session.user.id))
        : eq(users.isPublic, true)
    )
    .orderBy(desc(posts.createdAt))
    .limit(FEED_CANDIDATE_POOL);

  const ranked = rankPosts(
    viewer,
    rows.map((row) => ({ ...row, tags: parseTags(row.tags) }))
  );

  const page = ranked.slice(cursor, cursor + limit);
  const nextCursor = cursor + limit < ranked.length ? cursor + limit : null;
  const pageIds = page.map((p) => p.id);
  const [likedPostIds, mediaByPostId] = await Promise.all([
    getLikedPostIds(session?.user?.id, pageIds),
    getPostMediaByPostId(pageIds),
  ]);

  return NextResponse.json({
    posts: page.map((row) => toPostView(row, likedPostIds, mediaByPostId)),
    nextCursor,
  });
}
