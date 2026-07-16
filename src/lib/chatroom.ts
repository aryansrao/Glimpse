import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatRooms, roomMembers, roomRoles } from "@/db/schema";
import {
  OWNER_ROLE_PERMISSIONS,
  hasPermission,
  type RoomPermission,
} from "@/lib/permissions";

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return base || "room";
}

export async function getRoomBySlug(slug: string) {
  const [room] = await db.select().from(chatRooms).where(eq(chatRooms.slug, slug));
  return room ?? null;
}

export async function getMembership(roomId: string, userId: string) {
  const [member] = await db
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)));
  return member ?? null;
}

export function parsePermissions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getMemberPermissions(roomId: string, userId: string) {
  const member = await getMembership(roomId, userId);
  if (!member) return { member: null, permissions: [] as string[] };
  if (member.isOwner) return { member, permissions: [...OWNER_ROLE_PERMISSIONS] as string[] };
  if (!member.roleId) return { member, permissions: [] as string[] };
  const [role] = await db.select().from(roomRoles).where(eq(roomRoles.id, member.roleId));
  return { member, permissions: parsePermissions(role?.permissions) };
}

export function can(permissions: string[], permission: RoomPermission) {
  return hasPermission(permissions, permission);
}
