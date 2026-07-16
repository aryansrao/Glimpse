import { NextResponse } from "next/server";
import { and, desc, eq, like, or } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { chatRooms, posts, users } from "@/db/schema";
import {
  getLikedPostIds,
  getPostMediaByPostId,
  postSelection,
  toPostView,
  type PostView,
} from "@/lib/feed";
import { parseTags } from "@/lib/social";

const typeSchema = z.enum(["all", "users", "rooms", "posts"]);

type UserResult = {
  id: string;
  handle: string;
  name: string;
  bio: string | null;
  avatarWebpBase64: string | null;
};

type RoomResult = {
  slug: string;
  name: string;
  topic: string | null;
  icon: string | null;
  memberCount: number;
  tags: string[];
};

/**
 * GET /api/search?q=<1-80 chars>&type=all|users|rooms|posts
 *
 * Universal search over public users, public chatrooms, and posts.
 * Each list is capped at 10 results (20 when `type` targets one kind).
 * Prefix modes: "#tag" searches tag membership on posts + rooms;
 * "@handle" is a user-handle prefix search. Works signed out; `liked`
 * on posts reflects the session when one exists.
 */
export async function GET(req: Request) {
  const session = await auth();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 1 || q.length > 80) {
    return NextResponse.json(
      { error: "Search query must be 1-80 characters." },
      { status: 400 }
    );
  }

  const parsedType = typeSchema.safeParse(searchParams.get("type") ?? "all");
  if (!parsedType.success) {
    return NextResponse.json({ error: "Invalid search type." }, { status: 400 });
  }
  const type = parsedType.data;
  const cap = type === "all" ? 10 : 20;

  const tagTerm = q.startsWith("#") ? q.slice(1).trim().toLowerCase() : null;
  const handleTerm = q.startsWith("@") ? q.slice(1).trim().toLowerCase() : null;

  let userResults: UserResult[] = [];
  let roomResults: RoomResult[] = [];
  let postResults: PostView[] = [];

  if (type === "all" || type === "users") {
    // "#tag" queries target posts/rooms, not people.
    if (tagTerm === null) {
      const userFilter =
        handleTerm !== null
          ? handleTerm
            ? like(users.handle, `${handleTerm}%`)
            : null
          : or(
              like(users.handle, `%${q}%`),
              like(users.name, `%${q}%`),
              like(users.bio, `%${q}%`)
            )!;
      if (userFilter) {
        userResults = await db
          .select({
            id: users.id,
            handle: users.handle,
            name: users.name,
            bio: users.bio,
            avatarWebpBase64: users.avatarWebpBase64,
          })
          .from(users)
          .where(and(eq(users.isPublic, true), userFilter))
          .limit(cap);
      }
    }
  }

  if ((type === "all" || type === "rooms") && handleTerm === null) {
    const roomFilter = tagTerm
      ? like(chatRooms.tags, `%"${tagTerm}"%`)
      : tagTerm === null
        ? or(
            like(chatRooms.name, `%${q}%`),
            like(chatRooms.topic, `%${q}%`),
            like(chatRooms.tags, `%${q}%`)
          )!
        : null;
    if (roomFilter) {
      const rows = await db
        .select({
          slug: chatRooms.slug,
          name: chatRooms.name,
          topic: chatRooms.topic,
          icon: chatRooms.icon,
          memberCount: chatRooms.memberCount,
          tags: chatRooms.tags,
        })
        .from(chatRooms)
        .where(and(eq(chatRooms.visibility, "public"), roomFilter))
        .orderBy(desc(chatRooms.memberCount))
        .limit(cap);
      roomResults = rows.map((row) => ({ ...row, tags: parseTags(row.tags) }));
    }
  }

  if ((type === "all" || type === "posts") && handleTerm === null) {
    const postFilter = tagTerm
      ? like(posts.tags, `%"${tagTerm}"%`)
      : tagTerm === null
        ? or(like(posts.body, `%${q}%`), like(posts.tags, `%${q}%`))!
        : null;
    if (postFilter) {
      const rows = await db
        .select(postSelection)
        .from(posts)
        .innerJoin(users, eq(posts.userId, users.id))
        .where(and(eq(users.isPublic, true), postFilter))
        .orderBy(desc(posts.createdAt))
        .limit(cap);
      const postIds = rows.map((r) => r.id);
      const [likedPostIds, mediaByPostId] = await Promise.all([
        getLikedPostIds(session?.user?.id, postIds),
        getPostMediaByPostId(postIds),
      ]);
      postResults = rows.map((row) =>
        toPostView(row, likedPostIds, mediaByPostId)
      );
    }
  }

  return NextResponse.json({
    users: userResults,
    rooms: roomResults,
    posts: postResults,
  });
}
