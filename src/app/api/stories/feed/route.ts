import { NextResponse } from "next/server";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { follows, stories, storyViews, users } from "@/db/schema";
import { LIST_LIMIT, publicUserColumns, type PublicUser } from "@/lib/social";

// Enough rows to fill LIST_LIMIT groups even when authors post several stories.
const STORY_FETCH_LIMIT = 250;

type FeedStory = {
  id: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "text" | "pdf";
  caption: string | null;
  createdAt: Date;
  seen: boolean;
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to see stories." }, { status: 401 });
  }
  const me = session.user.id;

  const followingRows = await db
    .select({ id: follows.followingId })
    .from(follows)
    .where(eq(follows.followerId, me));
  const authorIds = [me, ...followingRows.map((r) => r.id)];

  // Newest first, so the first appearance of each author is their newest story.
  // Use unix seconds for expiresAt comparison, not Date (which is milliseconds).
  const nowSeconds = Math.floor(Date.now() / 1000);
  const rows = await db
    .select()
    .from(stories)
    .where(and(inArray(stories.userId, authorIds), gt(stories.expiresAt, sql`${nowSeconds}`)))
    .orderBy(desc(stories.createdAt))
    .limit(STORY_FETCH_LIMIT);

  if (rows.length === 0) return NextResponse.json({ groups: [] });

  const [viewRows, userRows] = await Promise.all([
    db
      .select({ storyId: storyViews.storyId })
      .from(storyViews)
      .where(
        and(
          eq(storyViews.viewerId, me),
          inArray(
            storyViews.storyId,
            rows.map((r) => r.id)
          )
        )
      ),
    db
      .select(publicUserColumns)
      .from(users)
      .where(inArray(users.id, [...new Set(rows.map((r) => r.userId))])),
  ]);
  const seenIds = new Set(viewRows.map((v) => v.storyId));
  const userById = new Map(userRows.map((u) => [u.id, u]));

  // Insertion order = newest-story-desc order across authors.
  const storiesByAuthor = new Map<string, FeedStory[]>();
  for (const s of rows) {
    const list = storiesByAuthor.get(s.userId) ?? [];
    list.push({
      id: s.id,
      mediaUrl: s.mediaUrl,
      mediaType: s.mediaType as "image" | "video" | "text" | "pdf",
      caption: s.caption,
      createdAt: s.createdAt,
      seen: seenIds.has(s.id),
    });
    storiesByAuthor.set(s.userId, list);
  }

  const orderedAuthorIds = [...storiesByAuthor.keys()];
  if (orderedAuthorIds.includes(me)) {
    orderedAuthorIds.splice(orderedAuthorIds.indexOf(me), 1);
    orderedAuthorIds.unshift(me);
  }

  const groups: { user: PublicUser; stories: FeedStory[]; allSeen: boolean }[] = [];
  for (const authorId of orderedAuthorIds) {
    if (groups.length >= LIST_LIMIT) break;
    const user = userById.get(authorId);
    if (!user) continue;
    const authorStories = storiesByAuthor
      .get(authorId)!
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    groups.push({
      user,
      stories: authorStories,
      allSeen: authorStories.every((s) => s.seen),
    });
  }

  return NextResponse.json({ groups });
}
