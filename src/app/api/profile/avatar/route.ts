import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

// A 256x256 WebP at reasonable quality lands well under this; this is a
// backstop against something slipping past client-side compression.
const MAX_BASE64_LENGTH = 400_000;

const schema = z.object({
  avatarWebpBase64: z.string().startsWith("data:image/webp;base64,").max(MAX_BASE64_LENGTH),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to set an avatar." }, { status: 401 });
  }

  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "That image couldn't be processed." }, { status: 400 });
  }

  await db
    .update(users)
    .set({ avatarWebpBase64: body.data.avatarWebpBase64 })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  await db.update(users).set({ avatarWebpBase64: null }).where(eq(users.id, session.user.id));
  return NextResponse.json({ ok: true });
}
