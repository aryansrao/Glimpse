import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { postLikes, postMedia, posts } from "@/db/schema";
import {
  parseTags,
  publicUserColumns,
  tagSimilarity,
  type PublicUser,
} from "@/lib/social";

/** Default page size for post lists (feed, profile grids, search). */
export const POST_PAGE_LIMIT = 20;

/** Rank over the most recent N posts — the feed's candidate pool. */
export const FEED_CANDIDATE_POOL = 200;

/** Feed ranking weights — see rankPosts below. */
const FOLLOW_WEIGHT = 3.0;
const TAG_WEIGHT = 2.0;
const MAX_AGE_PENALTY = 3;

/** One ordered media attachment on a post, as serialized in PostView. */
export type PostMediaView = {
  url: string;
  type: "image" | "video" | "pdf";
  fileName: string | null;
};

/** Canonical serialized post shape returned by every posts/search API. */
export type PostView = {
  id: string;
  body: string | null;
  /** Legacy single-media fields — mirror the FIRST item of `media`. */
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  /** All media attachments, ordered by position. Empty for text posts. */
  media: PostMediaView[];
  tags: string[];
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  /** Whether the session user liked this post — always false signed out. */
  liked: boolean;
  user: PublicUser;
};

/**
 * Shared drizzle selection for post payloads — requires an innerJoin of
 * `posts` with `users` on posts.userId = users.id.
 */
export const postSelection = {
  id: posts.id,
  userId: posts.userId,
  body: posts.body,
  mediaUrl: posts.mediaUrl,
  mediaType: posts.mediaType,
  tags: posts.tags,
  likeCount: posts.likeCount,
  commentCount: posts.commentCount,
  createdAt: posts.createdAt,
  user: publicUserColumns,
};

type PostRowLike = {
  id: string;
  body: string | null;
  mediaUrl: string | null;
  mediaType: "image" | "video" | null;
  /** Raw JSON column or already-parsed tag list. */
  tags: string | string[];
  likeCount: number;
  commentCount: number;
  createdAt: Date;
  user: PublicUser;
};

/** Serialize a joined post row into the public PostView shape. */
export function toPostView(
  row: PostRowLike,
  likedPostIds: Set<string>,
  mediaByPostId?: Map<string, PostMediaView[]>
): PostView {
  return {
    id: row.id,
    body: row.body,
    mediaUrl: row.mediaUrl,
    mediaType: row.mediaType,
    media: mediaByPostId?.get(row.id) ?? [],
    tags: Array.isArray(row.tags) ? row.tags : parseTags(row.tags),
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    createdAt: row.createdAt,
    liked: likedPostIds.has(row.id),
    user: row.user,
  };
}

/**
 * The session user's ranking signals. `null` when signed out — ranking
 * then degrades gracefully to engagement + recency only.
 */
export type FeedViewer = {
  /** The viewer's interest tags (users.tags, parsed). */
  tags: string[];
  /** Ids of users the viewer follows. */
  followedUserIds: Set<string>;
} | null;

export type RankablePost = {
  userId: string;
  /** Parsed hashtag list for the post. */
  tags: string[];
  likeCount: number;
  commentCount: number;
  createdAt: Date;
};

/**
 * Pure feed-ranking function. Score per post:
 *
 *   score = 3.0 * isFollowed(viewer follows author)
 *         + 2.0 * tagSimilarity(viewer.tags, post.tags)   [Jaccard, 0..1]
 *         + log10(1 + likeCount + 2 * commentCount)       [engagement]
 *         - min(hoursOld / 24, 3)                         [age penalty]
 *
 * Signed-out viewers (viewer = null) get engagement + recency only.
 * Ties break to newest first. The input array is not mutated.
 */
export function rankPosts<T extends RankablePost>(
  viewer: FeedViewer,
  candidatePosts: T[],
  now: number = Date.now()
): T[] {
  return candidatePosts
    .map((post) => {
      let score = 0;
      if (viewer) {
        if (viewer.followedUserIds.has(post.userId)) score += FOLLOW_WEIGHT;
        score += TAG_WEIGHT * tagSimilarity(viewer.tags, post.tags).score;
      }
      score += Math.log10(1 + post.likeCount + 2 * post.commentCount);
      const hoursOld = Math.max(0, (now - post.createdAt.getTime()) / 3_600_000);
      score -= Math.min(hoursOld / 24, MAX_AGE_PENALTY);
      return { post, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.post.createdAt.getTime() - a.post.createdAt.getTime()
    )
    .map((entry) => entry.post);
}

/**
 * Which of `postIds` the given user has liked. Empty set when signed
 * out — callers can pass the result straight to toPostView.
 */
export async function getLikedPostIds(
  userId: string | null | undefined,
  postIds: string[]
): Promise<Set<string>> {
  if (!userId || postIds.length === 0) return new Set();
  const rows = await db
    .select({ postId: postLikes.postId })
    .from(postLikes)
    .where(and(eq(postLikes.userId, userId), inArray(postLikes.postId, postIds)));
  return new Set(rows.map((r) => r.postId));
}

/**
 * All media attachments for the given posts — ONE query, grouped by
 * postId, each list ordered by position. Pass the result to toPostView.
 */
export async function getPostMediaByPostId(
  postIds: string[]
): Promise<Map<string, PostMediaView[]>> {
  const byPost = new Map<string, PostMediaView[]>();
  if (postIds.length === 0) return byPost;
  const rows = await db
    .select({
      postId: postMedia.postId,
      url: postMedia.url,
      type: postMedia.type,
      fileName: postMedia.fileName,
    })
    .from(postMedia)
    .where(inArray(postMedia.postId, postIds))
    .orderBy(asc(postMedia.postId), asc(postMedia.position));
  for (const row of rows) {
    const list = byPost.get(row.postId);
    const item = { url: row.url, type: row.type, fileName: row.fileName };
    if (list) list.push(item);
    else byPost.set(row.postId, [item]);
  }
  return byPost;
}

const HASHTAG_RE = /#([\p{L}\p{N}_-]{2,24})/gu;
const MAX_HASHTAGS = 8;

/**
 * Extract #hashtags from a post body — lowercased, deduped, capped at 8,
 * in order of first appearance.
 */
export function extractHashtags(body: string | null | undefined): string[] {
  if (!body) return [];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(HASHTAG_RE)) {
    const tag = match[1].toLowerCase();
    if (seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= MAX_HASHTAGS) break;
  }
  return tags;
}

/**
 * Parse a `?cursor=<epoch ms>` query param into a Date, or null when
 * absent/invalid. (The feed route uses an offset cursor instead — see
 * /api/posts/feed.)
 */
export function parseTimeCursor(raw: string | null): Date | null {
  if (!raw || raw.trim() === "") return null;
  const ms = Number(raw);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
}
