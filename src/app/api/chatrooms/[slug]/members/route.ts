import { NextResponse } from "next/server";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { roomMembers, roomRoles, users } from "@/db/schema";
import { resolveIdentity } from "@/lib/identity";
import { getMemberPermissions, getRoomBySlug, parsePermissions } from "@/lib/chatroom";

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

  const members = await db
    .select()
    .from(roomMembers)
    .where(eq(roomMembers.roomId, room.id))
    .orderBy(asc(roomMembers.joinedAt));

  const userIds = members.map((m) => m.userId);
  const roleIds = [...new Set(members.map((m) => m.roleId).filter((id): id is string => !!id))];

  const [userRows, roleRows] = await Promise.all([
    userIds.length
      ? db.select().from(users).where(inArray(users.id, userIds))
      : Promise.resolve([]),
    roleIds.length
      ? db.select().from(roomRoles).where(inArray(roomRoles.id, roleIds))
      : Promise.resolve([]),
  ]);

  const userById = new Map(userRows.map((u) => [u.id, u]));
  const roleById = new Map(roleRows.map((r) => [r.id, r]));

  return NextResponse.json({
    members: members.map((m) => {
      const u = userById.get(m.userId);
      const role = m.roleId ? roleById.get(m.roleId) : null;
      return {
        userId: m.userId,
        isOwner: m.isOwner,
        joinedAt: m.joinedAt,
        name: u?.name ?? "Guest",
        handle: u?.handle ?? null,
        avatarWebpBase64: u?.avatarWebpBase64 ?? null,
        role: role
          ? { id: role.id, name: role.name, color: role.color, permissions: parsePermissions(role.permissions) }
          : null,
      };
    }),
  });
}
