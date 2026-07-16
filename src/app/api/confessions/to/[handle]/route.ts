import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { confessions, users } from "@/db/schema";

const bodySchema = z.object({
  body: z
    .string()
    .trim()
    .min(3, "Say a little more than that.")
    .max(500, "Confessions are capped at 500 characters."),
});

const HOURLY_LIMIT = 5;

/** Anonymous — works for guests too. Captures sender identity if signed in. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const session = await auth();
  const { handle } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const [target] = await db
    .select({ id: users.id, isPublic: users.isPublic })
    .from(users)
    .where(eq(users.handle, handle.toLowerCase()));
  if (!target || !target.isPublic) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  // Rate limit: hash of caller IP + current hour — rotates hourly, never
  // stored in a form that identifies the sender.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  const senderBucket = createHash("sha256")
    .update(`${ip}:${hourBucket}`)
    .digest("hex")
    .slice(0, 32);

  const hourAgo = new Date(Date.now() - 3_600_000);
  const recent = await db
    .select({ id: confessions.id })
    .from(confessions)
    .where(
      and(
        eq(confessions.senderBucket, senderBucket),
        gt(confessions.createdAt, hourAgo)
      )
    )
    .limit(HOURLY_LIMIT);
  if (recent.length >= HOURLY_LIMIT) {
    return NextResponse.json(
      { error: "Slow down — try again in a bit." },
      { status: 429 }
    );
  }

  await db.insert(confessions).values({
    id: nanoid(),
    toUserId: target.id,
    body: parsed.data.body,
    senderBucket,
    senderUserId: session?.user?.id ?? null,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
