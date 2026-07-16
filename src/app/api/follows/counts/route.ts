import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { follows } from "@/db/schema";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId")?.trim() || session.user.id;

  const [[followers], [following]] = await Promise.all([
    db.select({ n: count() }).from(follows).where(eq(follows.followingId, userId)),
    db.select({ n: count() }).from(follows).where(eq(follows.followerId, userId)),
  ]);

  return NextResponse.json({
    followers: followers?.n ?? 0,
    following: following?.n ?? 0,
  });
}
