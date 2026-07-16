import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { chatRooms, roomInvites, roomMembers, roomRoles } from "@/db/schema";
import { auth } from "@/auth";
import { resolveIdentity } from "@/lib/identity";
import { getMembership, getRoomBySlug } from "@/lib/chatroom";

const bodySchema = z.object({ inviteCode: z.string().trim().max(40).optional() });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const inviteCode = parsed.success ? parsed.data.inviteCode : undefined;

  const session = await auth();

  if (room.visibility === "private" && !session?.user) {
    return NextResponse.json(
      { error: "Sign in to join this room." },
      { status: 401 }
    );
  }

  const identity = session?.user ? { id: session.user.id } : await resolveIdentity();

  const existing = await getMembership(room.id, identity.id);
  if (existing) {
    return NextResponse.json({ joined: true, alreadyMember: true });
  }

  if (room.visibility === "private") {
    if (!inviteCode) {
      return NextResponse.json({ error: "An invite code is required." }, { status: 403 });
    }
    const [invite] = await db
      .select()
      .from(roomInvites)
      .where(and(eq(roomInvites.roomId, room.id), eq(roomInvites.code, inviteCode)));

    if (!invite) {
      return NextResponse.json({ error: "That invite is invalid." }, { status: 403 });
    }
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "That invite has expired." }, { status: 403 });
    }
    if (invite.maxUses != null && invite.useCount >= invite.maxUses) {
      return NextResponse.json({ error: "That invite has been used up." }, { status: 403 });
    }
    await db
      .update(roomInvites)
      .set({ useCount: invite.useCount + 1 })
      .where(eq(roomInvites.id, invite.id));
  }

  const [defaultRole] = await db
    .select()
    .from(roomRoles)
    .where(and(eq(roomRoles.roomId, room.id), eq(roomRoles.isDefault, true)));

  await db.insert(roomMembers).values({
    id: nanoid(),
    roomId: room.id,
    userId: identity.id,
    roleId: defaultRole?.id ?? null,
    isOwner: false,
  });

  await db
    .update(chatRooms)
    .set({ memberCount: room.memberCount + 1 })
    .where(eq(chatRooms.id, room.id));

  return NextResponse.json({ joined: true, alreadyMember: false });
}
