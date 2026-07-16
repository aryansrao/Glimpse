import { NextResponse } from "next/server";
import { and, eq, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { follows } from "@/db/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const me = session.user.id;
  const rows = await db
    .select({ followerId: follows.followerId })
    .from(follows)
    .where(
      or(
        and(eq(follows.followerId, me), eq(follows.followingId, userId)),
        and(eq(follows.followerId, userId), eq(follows.followingId, me))
      )
    );

  const following = rows.some((r) => r.followerId === me);
  const followedBy = rows.some((r) => r.followerId === userId);

  return NextResponse.json({ following, followedBy, friends: following && followedBy });
}
