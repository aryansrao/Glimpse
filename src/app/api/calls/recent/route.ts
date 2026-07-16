import { NextResponse } from "next/server";
import { desc, eq, inArray, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { recentCalls, users } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Last 10 distinct random-call partners for the session user:
 * [{ user: { id, handle, name, avatarWebpBase64 }, mode, endedAt }]
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const me = session.user.id;

  const rows = await db
    .select()
    .from(recentCalls)
    .where(or(eq(recentCalls.userAId, me), eq(recentCalls.userBId, me)))
    .orderBy(desc(recentCalls.endedAt))
    .limit(60);

  const seen = new Set<string>();
  const picks: { partnerId: string; mode: "video" | "audio"; endedAt: Date }[] = [];
  for (const row of rows) {
    const partnerId = row.userAId === me ? row.userBId : row.userAId;
    if (partnerId === me || seen.has(partnerId)) continue;
    seen.add(partnerId);
    picks.push({ partnerId, mode: row.mode, endedAt: row.endedAt });
    if (picks.length >= 10) break;
  }

  if (picks.length === 0) return NextResponse.json([]);

  const partnerRows = await db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      avatarWebpBase64: users.avatarWebpBase64,
    })
    .from(users)
    .where(
      inArray(
        users.id,
        picks.map((p) => p.partnerId)
      )
    );
  const byId = new Map(partnerRows.map((u) => [u.id, u]));

  const result = picks.flatMap((p) => {
    const user = byId.get(p.partnerId);
    if (!user) return [];
    return [{ user, mode: p.mode, endedAt: p.endedAt }];
  });

  return NextResponse.json(result);
}
