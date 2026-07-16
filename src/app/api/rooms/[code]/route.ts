import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rooms } from "@/db/schema";

async function getRoom(code: string) {
  const [room] = await db
    .select()
    .from(rooms)
    .where(eq(rooms.code, code.toUpperCase()));
  return room;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const room = await getRoom(code);
  if (!room || room.status === "closed" || room.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "This room doesn't exist or has expired." }, { status: 404 });
  }
  const { hostToken: _hostToken, hostPeerId: _hostPeerId, guestPeerId: _guestPeerId, ...publicRoom } = room;
  return NextResponse.json(publicRoom);
}

// Joining no longer claims a single guest slot — POST is an alias of the
// multi-participant join flow (see ./join/route.ts for the contract).
export { POST } from "./join/route";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  await db.update(rooms).set({ status: "closed" }).where(eq(rooms.code, code.toUpperCase()));
  return NextResponse.json({ ok: true });
}
