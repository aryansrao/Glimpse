import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { roomMessages } from "@/db/schema";
import { resolveIdentity } from "@/lib/identity";
import { can, getMemberPermissions, getRoomBySlug } from "@/lib/chatroom";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; messageId: string }> }
) {
  const { slug, messageId } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const identity = await resolveIdentity();
  const { member, permissions } = await getMemberPermissions(room.id, identity.id);
  if (!member) return NextResponse.json({ error: "You're not a member of this room." }, { status: 403 });

  const [message] = await db
    .select()
    .from(roomMessages)
    .where(and(eq(roomMessages.roomId, room.id), eq(roomMessages.id, messageId)));
  if (!message) return NextResponse.json({ error: "Message not found." }, { status: 404 });

  const isOwnMessage = message.userId === identity.id;
  if (!isOwnMessage && !can(permissions, "manage_messages")) {
    return NextResponse.json({ error: "You can't delete this message." }, { status: 403 });
  }

  await db.delete(roomMessages).where(eq(roomMessages.id, messageId));
  return NextResponse.json({ ok: true });
}
