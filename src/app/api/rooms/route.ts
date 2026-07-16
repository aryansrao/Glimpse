import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import {
  generateRoomCode,
  ROOM_TTL_MS,
  MIN_ROOM_PARTICIPANTS,
  MAX_ROOM_PARTICIPANTS,
} from "@/lib/room-code";
import { resolveIdentity } from "@/lib/identity";
import { nanoid } from "nanoid";
import { z } from "zod";

const schema = z.object({
  mode: z.enum(["video", "audio"]).default("video"),
  maxParticipants: z
    .number()
    .int()
    .min(MIN_ROOM_PARTICIPANTS)
    .max(MAX_ROOM_PARTICIPANTS)
    .default(8),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { mode, maxParticipants } = parsed.data;

  const identity = await resolveIdentity();
  const hostPeerId = `glimpse-room-${nanoid(12)}`;
  const hostToken = nanoid(24);

  let code = generateRoomCode();
  // Extremely unlikely to collide, but guard anyway.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [clash] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
    if (!clash) break;
    code = generateRoomCode();
  }

  await db.insert(rooms).values({
    code,
    mode,
    hostToken,
    hostPeerId,
    hostName: identity.name,
    hostUserId: identity.isGuest ? null : identity.id,
    maxParticipants,
    status: "waiting",
    expiresAt: new Date(Date.now() + ROOM_TTL_MS),
  });

  return NextResponse.json({
    code,
    hostPeerId,
    hostToken,
    mode,
    maxParticipants,
    hostName: identity.name,
    shareUrl: `/room/${code}`,
  });
}
