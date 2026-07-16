import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { stories } from "@/db/schema";

const DATA_URL_PREFIX = "data:image/webp;base64,";
// ~500KB of binary is ~683K base64 chars; this is the backstop.
const MAX_BASE64_LENGTH = 700_000;
const MAX_BYTES = 500 * 1024;
const STORY_TTL_MS = 24 * 60 * 60 * 1000;

const schema = z.object({
  mediaBase64: z.string().startsWith(DATA_URL_PREFIX).max(MAX_BASE64_LENGTH),
  caption: z.string().trim().max(140).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to post a story." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That image couldn't be processed." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(
    parsed.data.mediaBase64.slice(DATA_URL_PREFIX.length),
    "base64"
  );
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "Story image must be between 1 byte and 500KB." },
      { status: 400 }
    );
  }

  let mediaUrl: string;
  try {
    const blob = await put(`stories/${session.user.id}/${nanoid()}.webp`, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/webp",
    });
    mediaUrl = blob.url;
  } catch {
    // No Blob token configured — fall back to storing the data URL directly.
    mediaUrl = parsed.data.mediaBase64;
  }

  const [story] = await db
    .insert(stories)
    .values({
      id: nanoid(),
      userId: session.user.id,
      mediaUrl,
      caption: parsed.data.caption || null,
      expiresAt: new Date(Date.now() + STORY_TTL_MS),
    })
    .returning();

  return NextResponse.json({ id: story.id, mediaUrl: story.mediaUrl }, { status: 201 });
}
