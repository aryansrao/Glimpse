import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { chatRooms, roomRoles } from "@/db/schema";
import { resolveIdentity } from "@/lib/identity";
import { can, getMemberPermissions, getRoomBySlug } from "@/lib/chatroom";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const identity = await resolveIdentity();
  const { member, permissions } = await getMemberPermissions(room.id, identity.id);

  let role = null;
  if (member?.roleId) {
    const [r] = await db.select().from(roomRoles).where(eq(roomRoles.id, member.roleId));
    role = r ?? null;
  }

  if (!member && room.visibility === "private") {
    return NextResponse.json(
      {
        room: { slug: room.slug, name: room.name, visibility: room.visibility, icon: room.icon },
        viewer: { isMember: false, isOwner: false, permissions: [], requiresInvite: true },
      },
      { status: 403 }
    );
  }

  return NextResponse.json({
    room: { ...room, tags: JSON.parse(room.tags) as string[] },
    viewer: {
      isMember: !!member,
      isOwner: !!member?.isOwner,
      role: role ? { id: role.id, name: role.name, color: role.color } : null,
      permissions,
    },
  });
}

const patchSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  icon: z
    .string()
    .trim()
    .refine(
      (v) =>
        v.length <= 8 ||
        (v.startsWith("data:image/webp;base64,") && v.length <= 80_000),
      "Icon must be a short emoji or an uploaded image"
    )
    .optional(),
  topic: z.string().trim().max(120).optional(),
  description: z.string().trim().max(300).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const identity = await resolveIdentity();
  const { permissions } = await getMemberPermissions(room.id, identity.id);
  if (!can(permissions, "manage_room")) {
    return NextResponse.json({ error: "You can't manage this room." }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const [updated] = await db
    .update(chatRooms)
    .set(parsed.data)
    .where(eq(chatRooms.id, room.id))
    .returning();

  return NextResponse.json({ room: { ...updated, tags: JSON.parse(updated.tags) as string[] } });
}
