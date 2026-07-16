import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { db } from "@/db";
import { rooms, queueEntries } from "@/db/schema";
import { verifyParticipantToken } from "@/lib/room-code";

export const runtime = "nodejs";

const schema = z.object({
  roomName: z.string().min(1),
  name: z.string().min(1).max(64),
  authToken: z.string().min(1),
});

type Authorized = {
  identity: string;
  /** Set for private rooms — enforced against live occupancy before minting. */
  maxParticipants?: number;
};

/**
 * Mints a LiveKit join token, but only after checking the caller actually
 * holds a capability for the requested room. Private rooms are Discord-style
 * N-person rooms now: the host holds `hostToken`, every joiner holds a fresh
 * stateless participant token (HMAC keyed by the room's hostToken), and
 * capacity is enforced here by counting the room's live occupants.
 */
async function resolveAuthorized(roomName: string, authToken: string): Promise<Authorized | null> {
  if (roomName.startsWith("room-")) {
    const code = roomName.slice("room-".length).toUpperCase();
    const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
    if (!room || room.status === "closed" || room.expiresAt.getTime() < Date.now()) return null;
    if (authToken === room.hostToken) {
      return { identity: `host-${code}`, maxParticipants: room.maxParticipants };
    }
    const nonce = verifyParticipantToken(authToken, code, room.hostToken);
    if (nonce) {
      return { identity: `p-${nonce}`, maxParticipants: room.maxParticipants };
    }
    // Legacy single-guest slot, kept so pre-migration joins still work.
    if (room.guestPeerId && authToken === room.guestPeerId) {
      return { identity: `guest-${code}`, maxParticipants: room.maxParticipants };
    }
    return null;
  }

  if (roomName.startsWith("queue-")) {
    const [entry] = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.peerId, authToken));
    if (!entry || entry.status !== "matched" || !entry.matchedWithPeerId) return null;
    const expectedRoomName = `queue-${[entry.peerId, entry.matchedWithPeerId].sort().join("-")}`;
    if (expectedRoomName !== roomName) return null;
    return { identity: entry.peerId };
  }

  return null;
}

/**
 * Returns true when the room still has space for `identity` (or when
 * occupancy can't be determined — dev without LiveKit env degrades to open).
 */
async function hasCapacity(
  roomName: string,
  identity: string,
  maxParticipants: number,
  apiKey: string,
  apiSecret: string
): Promise<boolean> {
  try {
    const url = process.env.LIVEKIT_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!url) return true;
    const svc = new RoomServiceClient(url, apiKey, apiSecret);
    const participants = await svc.listParticipants(roomName);
    // Reconnects shouldn't count themselves toward the cap.
    const others = participants.filter((p) => p.identity !== identity);
    return others.length < maxParticipants;
  } catch {
    // Room not created yet, or LiveKit unreachable/unset — allow the join.
    return true;
  }
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { roomName, name, authToken } = parsed.data;

  const authorized = await resolveAuthorized(roomName, authToken);
  if (!authorized) {
    return NextResponse.json({ error: "Not authorized to join this call." }, { status: 403 });
  }

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "Calling isn't configured yet." }, { status: 500 });
  }

  if (
    authorized.maxParticipants &&
    !(await hasCapacity(roomName, authorized.identity, authorized.maxParticipants, apiKey, apiSecret))
  ) {
    return NextResponse.json({ error: "Room is full." }, { status: 409 });
  }

  const at = new AccessToken(apiKey, apiSecret, { identity: authorized.identity, name, ttl: "10m" });
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
