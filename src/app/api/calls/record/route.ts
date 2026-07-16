import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, eq, gt, ne } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { queueEntries, recentCalls, type QueueEntry } from "@/db/schema";

const schema = z.object({ peerId: z.string().min(1) });

/**
 * Records a finished random call so both signed-in participants can rejoin
 * each other later. Body: { peerId } — the caller's opaque queue peer id.
 * Guests (no session) and guest partners are silently skipped.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: true, recorded: 0 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const [entry] = await db
    .select()
    .from(queueEntries)
    .where(eq(queueEntries.peerId, parsed.data.peerId));

  if (
    !entry ||
    entry.userId !== session.user.id ||
    entry.status !== "matched" ||
    !entry.matchedWithPeerId
  ) {
    return NextResponse.json({ ok: true, recorded: 0 });
  }

  let partners: QueueEntry[];
  if (entry.groupSize > 2) {
    // matchedWithPeerId is the shared group key on every member's row.
    partners = await db
      .select()
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.matchedWithPeerId, entry.matchedWithPeerId),
          eq(queueEntries.status, "matched"),
          ne(queueEntries.id, entry.id)
        )
      );
  } else {
    partners = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.peerId, entry.matchedWithPeerId));
  }

  const partnerUserIds = [
    ...new Set(
      partners
        .map((p) => p.userId)
        .filter((id): id is string => !!id && id !== session.user.id)
    ),
  ];

  const now = new Date();
  const dedupeSince = new Date(now.getTime() - 60_000);
  let recorded = 0;

  for (const partnerId of partnerUserIds) {
    const [a, b] = [session.user.id, partnerId].sort();
    // Both sides report the same ended call — skip if the pair was already
    // recorded moments ago.
    const [existing] = await db
      .select({ id: recentCalls.id })
      .from(recentCalls)
      .where(
        and(
          eq(recentCalls.userAId, a),
          eq(recentCalls.userBId, b),
          gt(recentCalls.endedAt, dedupeSince)
        )
      )
      .limit(1);
    if (existing) continue;

    await db.insert(recentCalls).values({
      id: nanoid(),
      userAId: a,
      userBId: b,
      mode: entry.mode,
      endedAt: now,
    });
    recorded++;
  }

  return NextResponse.json({ ok: true, recorded });
}
