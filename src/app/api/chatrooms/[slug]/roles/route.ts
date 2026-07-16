import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { roomRoles } from "@/db/schema";
import { resolveIdentity } from "@/lib/identity";
import { can, getMemberPermissions, getRoomBySlug } from "@/lib/chatroom";
import { ROOM_PERMISSIONS } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const identity = await resolveIdentity();
  const { member } = await getMemberPermissions(room.id, identity.id);
  if (!member) return NextResponse.json({ error: "You're not a member of this room." }, { status: 403 });

  const roles = await db
    .select()
    .from(roomRoles)
    .where(eq(roomRoles.roomId, room.id))
    .orderBy(asc(roomRoles.position));

  return NextResponse.json({
    roles: roles.map((r) => ({ ...r, permissions: JSON.parse(r.permissions) as string[] })),
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(30),
  color: z.string().trim().max(20).optional(),
  permissions: z.array(z.enum(ROOM_PERMISSIONS)).default([]),
  position: z.number().int().min(0).max(99).default(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const identity = await resolveIdentity();
  const { permissions } = await getMemberPermissions(room.id, identity.id);
  if (!can(permissions, "manage_roles")) {
    return NextResponse.json({ error: "You can't manage roles here." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  const [role] = await db
    .insert(roomRoles)
    .values({
      id: nanoid(),
      roomId: room.id,
      name: parsed.data.name,
      color: parsed.data.color ?? null,
      permissions: JSON.stringify(parsed.data.permissions),
      position: parsed.data.position,
      isDefault: false,
    })
    .returning();

  return NextResponse.json(
    { role: { ...role, permissions: JSON.parse(role.permissions) as string[] } },
    { status: 201 }
  );
}
