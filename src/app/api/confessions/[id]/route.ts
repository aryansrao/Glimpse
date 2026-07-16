import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { confessions } from "@/db/schema";

/** Recipient can delete confessions off their profile. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await db
    .delete(confessions)
    .where(and(eq(confessions.id, id), eq(confessions.toUserId, session.user.id)))
    .returning({ id: confessions.id });

  if (deleted.length === 0) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
