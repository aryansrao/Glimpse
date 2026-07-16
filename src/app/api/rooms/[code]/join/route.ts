import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "@/db/schema";
import { mintParticipantToken } from "@/lib/room-code";
import { resolveIdentity } from "@/lib/identity";

/**
 * Joins a private room. Rooms are no longer a host + single-guest pair:
 * every join mints a fresh, stateless participant capability token, and
 * capacity (rooms.maxParticipants) is enforced when the LiveKit join token
 * is minted (/api/livekit/token) by counting live room occupants.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();

  const [room] = await db.select().from(rooms).where(eq(rooms.code, code));
  if (!room || room.status === "closed" || room.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This room doesn't exist or has expired." },
      { status: 404 }
    );
  }

  const identity = await resolveIdentity();
  const participantToken = mintParticipantToken(code, room.hostToken);

  // Keep the legacy status/guestName fields fresh so the host's SSE stream
  // ("joined" fires when status flips to occupied) keeps working. Multiple
  // joins simply keep the room occupied with the latest joiner's name.
  await db
    .update(rooms)
    .set({
      status: "occupied",
      guestName: identity.name,
      guestUserId: identity.isGuest ? null : identity.id,
    })
    .where(eq(rooms.code, code));

  return NextResponse.json({
    code,
    mode: room.mode,
    hostName: room.hostName,
    maxParticipants: room.maxParticipants,
    participantToken,
    name: identity.name,
  });
}
