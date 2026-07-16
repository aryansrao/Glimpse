import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auth } from "@/auth";
import { db } from "@/db";
import { stories, storyViews } from "@/db/schema";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const [story] = await db
    .select({ id: stories.id })
    .from(stories)
    .where(eq(stories.id, id))
    .limit(1);
  if (!story) {
    return NextResponse.json({ error: "That story doesn't exist." }, { status: 404 });
  }

  await db
    .insert(storyViews)
    .values({ id: nanoid(), storyId: id, viewerId: session.user.id })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true });
}
