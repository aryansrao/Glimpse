import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatRooms, roomMembers } from "@/db/schema";
import { resolveIdentity } from "@/lib/identity";
import { can, getMembership, getMemberPermissions, getRoomBySlug } from "@/lib/chatroom";

const patchSchema = z.object({ roleId: z.string().nullable() });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const { slug, userId } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const identity = await resolveIdentity();
  const { permissions } = await getMemberPermissions(room.id, identity.id);
  if (!can(permissions, "manage_roles") && !can(permissions, "manage_members")) {
    return NextResponse.json({ error: "You can't manage members here." }, { status: 403 });
  }

  const target = await getMembership(room.id, userId);
  if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (target.isOwner) {
    return NextResponse.json({ error: "The room owner's role can't be changed." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  await db
    .update(roomMembers)
    .set({ roleId: parsed.data.roleId })
    .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, userId)));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; userId: string }> }
) {
  const { slug, userId } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const identity = await resolveIdentity();
  const { permissions } = await getMemberPermissions(room.id, identity.id);
  if (!can(permissions, "manage_members")) {
    return NextResponse.json({ error: "You can't kick members here." }, { status: 403 });
  }

  const target = await getMembership(room.id, userId);
  if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (target.isOwner) {
    return NextResponse.json({ error: "The room owner can't be removed." }, { status: 400 });
  }

  await db
    .delete(roomMembers)
    .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, userId)));

  await db
    .update(chatRooms)
    .set({ memberCount: Math.max(0, room.memberCount - 1) })
    .where(eq(chatRooms.id, room.id));

  return NextResponse.json({ ok: true });
}
