import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { follows, users } from "@/db/schema";
import { LIST_LIMIT } from "@/lib/social";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  if (type !== "followers" && type !== "following") {
    return NextResponse.json(
      { error: "type must be 'followers' or 'following'." },
      { status: 400 }
    );
  }

  const targetId = searchParams.get("userId")?.trim() || session.user.id;
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "That user doesn't exist." }, { status: 404 });
  }

  const rows = await db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      avatarWebpBase64: users.avatarWebpBase64,
      isPublic: users.isPublic,
    })
    .from(follows)
    .innerJoin(
      users,
      eq(users.id, type === "followers" ? follows.followerId : follows.followingId)
    )
    .where(
      type === "followers"
        ? eq(follows.followingId, targetId)
        : eq(follows.followerId, targetId)
    )
    .orderBy(desc(follows.createdAt))
    .limit(LIST_LIMIT);

  return NextResponse.json({ users: rows });
}
