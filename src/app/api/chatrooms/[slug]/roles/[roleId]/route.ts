import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { roomMembers, roomRoles } from "@/db/schema";
import { resolveIdentity } from "@/lib/identity";
import { can, getMemberPermissions, getRoomBySlug } from "@/lib/chatroom";
import { ROOM_PERMISSIONS } from "@/lib/permissions";

async function loadRole(roomId: string, roleId: string) {
  const [role] = await db
    .select()
    .from(roomRoles)
    .where(and(eq(roomRoles.roomId, roomId), eq(roomRoles.id, roleId)));
  return role ?? null;
}

const patchSchema = z.object({
  name: z.string().trim().min(1).max(30).optional(),
  color: z.string().trim().max(20).optional(),
  permissions: z.array(z.enum(ROOM_PERMISSIONS)).optional(),
  position: z.number().int().min(0).max(99).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string; roleId: string }> }
) {
  const { slug, roleId } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const identity = await resolveIdentity();
  const { permissions } = await getMemberPermissions(room.id, identity.id);
  if (!can(permissions, "manage_roles")) {
    return NextResponse.json({ error: "You can't manage roles here." }, { status: 403 });
  }

  const role = await loadRole(room.id, roleId);
  if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
  if (role.name === "Owner") {
    return NextResponse.json({ error: "The Owner role can't be edited." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.permissions) update.permissions = JSON.stringify(parsed.data.permissions);

  const [updated] = await db
    .update(roomRoles)
    .set(update)
    .where(eq(roomRoles.id, roleId))
    .returning();

  return NextResponse.json({
    role: { ...updated, permissions: JSON.parse(updated.permissions) as string[] },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; roleId: string }> }
) {
  const { slug, roleId } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const identity = await resolveIdentity();
  const { permissions } = await getMemberPermissions(room.id, identity.id);
  if (!can(permissions, "manage_roles")) {
    return NextResponse.json({ error: "You can't manage roles here." }, { status: 403 });
  }

  const role = await loadRole(room.id, roleId);
  if (!role) return NextResponse.json({ error: "Role not found." }, { status: 404 });
  if (role.name === "Owner" || role.isDefault) {
    return NextResponse.json(
      { error: "The Owner and default Member roles can't be deleted." },
      { status: 400 }
    );
  }

  const [defaultRole] = await db
    .select()
    .from(roomRoles)
    .where(and(eq(roomRoles.roomId, room.id), eq(roomRoles.isDefault, true)));

  await db
    .update(roomMembers)
    .set({ roleId: defaultRole?.id ?? null })
    .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.roleId, roleId)));

  await db.delete(roomRoles).where(eq(roomRoles.id, roleId));

  return NextResponse.json({ ok: true });
}
