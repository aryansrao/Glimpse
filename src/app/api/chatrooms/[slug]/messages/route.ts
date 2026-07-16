import { NextResponse } from "next/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { roomMessages, users } from "@/db/schema";
import { resolveIdentity } from "@/lib/identity";
import { can, getMemberPermissions, getRoomBySlug } from "@/lib/chatroom";

async function hydrate(messages: (typeof roomMessages.$inferSelect)[]) {
  const userIds = [...new Set(messages.map((m) => m.userId))];
  const userRows = userIds.length
    ? await db.select().from(users).where(inArray(users.id, userIds))
    : [];
  const userById = new Map(userRows.map((u) => [u.id, u]));
  return messages.map((m) => ({
    id: m.id,
    roomId: m.roomId,
    userId: m.userId,
    body: m.body,
    mediaUrl: m.mediaUrl,
    mediaType: m.mediaType,
    createdAt: m.createdAt,
    sender: {
      name: userById.get(m.userId)?.name ?? "Guest",
      avatarWebpBase64: userById.get(m.userId)?.avatarWebpBase64 ?? null,
    },
  }));
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const identity = await resolveIdentity();
  const { member } = await getMemberPermissions(room.id, identity.id);
  if (!member) return NextResponse.json({ error: "You're not a member of this room." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 30, 1), 100);
  const before = searchParams.get("before");

  const filters = [eq(roomMessages.roomId, room.id)];
  if (before) {
    const cursor = new Date(Number(before));
    if (!Number.isNaN(cursor.getTime())) filters.push(lt(roomMessages.createdAt, cursor));
  }

  const rows = await db
    .select()
    .from(roomMessages)
    .where(and(...filters))
    .orderBy(desc(roomMessages.createdAt))
    .limit(limit);

  return NextResponse.json({ messages: await hydrate(rows) });
}

const postSchema = z
  .object({
    body: z.string().trim().max(4000).optional(),
    mediaUrl: z.string().url().optional(),
    mediaType: z.enum(["image", "video", "file"]).optional(),
  })
  .refine((d) => !!d.body || !!d.mediaUrl, { message: "Message can't be empty." });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const identity = await resolveIdentity();
  const { member, permissions } = await getMemberPermissions(room.id, identity.id);
  if (!member) return NextResponse.json({ error: "You're not a member of this room." }, { status: 403 });

  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid message." }, { status: 400 });
  }

  if (parsed.data.mediaUrl && !can(permissions, "send_media")) {
    return NextResponse.json({ error: "You can't send media in this room." }, { status: 403 });
  }

  const [message] = await db
    .insert(roomMessages)
    .values({
      id: nanoid(),
      roomId: room.id,
      userId: identity.id,
      body: parsed.data.body ?? null,
      mediaUrl: parsed.data.mediaUrl ?? null,
      mediaType: parsed.data.mediaUrl ? parsed.data.mediaType ?? "file" : null,
    })
    .returning();

  const [hydrated] = await hydrate([message]);
  return NextResponse.json({ message: hydrated }, { status: 201 });
}
