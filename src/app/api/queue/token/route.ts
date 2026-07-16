import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { AccessToken } from "livekit-server-sdk";
import { db } from "@/db";
import { queueEntries } from "@/db/schema";
import { roomNameForEntry } from "@/lib/matchmaking";

export const runtime = "nodejs";

const schema = z.object({
  roomName: z.string().min(1),
  name: z.string().min(1).max(64),
  authToken: z.string().min(1),
});

/**
 * Mints a LiveKit join token for random-queue calls (pair or group).
 * The caller proves membership with their opaque queue peer id; the room
 * they ask for must be exactly the room their matched entry belongs to
 * (`queue-<a>-<b>` for pairs, `queue-grp-<key>` for groups) — the group
 * shape the older /api/livekit/token route cannot validate.
 */
export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { roomName, name, authToken } = parsed.data;

  const [entry] = await db
    .select()
    .from(queueEntries)
    .where(eq(queueEntries.peerId, authToken));

  if (!entry || entry.status !== "matched" || roomNameForEntry(entry) !== roomName) {
    return NextResponse.json({ error: "Not authorized to join this call." }, { status: 403 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "Calling isn't configured yet." }, { status: 500 });
  }

  const at = new AccessToken(apiKey, apiSecret, { identity: entry.peerId, name, ttl: "10m" });
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const token = await at.toJwt();

  return NextResponse.json({ token, url: process.env.NEXT_PUBLIC_LIVEKIT_URL });
}
