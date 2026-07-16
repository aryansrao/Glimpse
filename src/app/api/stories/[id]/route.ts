import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { stories, storyViews } from "@/db/schema";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const [story] = await db.select().from(stories).where(eq(stories.id, id)).limit(1);
  if (!story) {
    return NextResponse.json({ error: "That story doesn't exist." }, { status: 404 });
  }
  if (story.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Only the owner can delete a story." },
      { status: 403 }
    );
  }

  await db.delete(storyViews).where(eq(storyViews.storyId, id));
  await db.delete(stories).where(eq(stories.id, id));

  return NextResponse.json({ ok: true });
}
