import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auth } from "@/auth";
import { db } from "@/db";
import { follows, users } from "@/db/schema";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to follow people." }, { status: 401 });
  }

  const { userId } = await params;
  if (userId === session.user.id) {
    return NextResponse.json({ error: "You can't follow yourself." }, { status: 400 });
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) {
    return NextResponse.json({ error: "That user doesn't exist." }, { status: 404 });
  }

  await db
    .insert(follows)
    .values({ id: nanoid(), followerId: session.user.id, followingId: userId })
    .onConflictDoNothing();

  return NextResponse.json({ following: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { userId } = await params;
  await db
    .delete(follows)
    .where(and(eq(follows.followerId, session.user.id), eq(follows.followingId, userId)));

  return NextResponse.json({ following: false });
}
