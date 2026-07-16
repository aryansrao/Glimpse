import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { joinQueue, leaveQueue, parseTags } from "@/lib/matchmaking";
import { resolveIdentity } from "@/lib/identity";

const schema = z.object({
  mode: z.enum(["video", "audio"]).default("video"),
  groupSize: z.number().int().min(2).max(6).default(2),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  const { mode, groupSize } = parsed.success
    ? parsed.data
    : { mode: "video" as const, groupSize: 2 };

  const identity = await resolveIdentity();
  const peerId = `glimpse-q-${nanoid(12)}`;

  // Signed-in searchers bring their profile tags along for
  // similarity-preferred matching; guests match purely FIFO.
  let tags: string[] = [];
  if (!identity.isGuest) {
    const [me] = await db
      .select({ tags: users.tags })
      .from(users)
      .where(eq(users.id, identity.id))
      .limit(1);
    tags = parseTags(me?.tags);
  }

  const result = await joinQueue({
    peerId,
    displayName: identity.name,
    userId: identity.isGuest ? null : identity.id,
    mode,
    groupSize,
    tags,
  });

  return NextResponse.json({ ...result, peerId, displayName: identity.name });
}

export async function DELETE(req: Request) {
  const { entryId } = await req.json().catch(() => ({ entryId: null }));
  if (entryId) await leaveQueue(entryId);
  return NextResponse.json({ ok: true });
}
