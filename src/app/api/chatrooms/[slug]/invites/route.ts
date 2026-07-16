import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { roomInvites } from "@/db/schema";
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
  const { permissions } = await getMemberPermissions(room.id, identity.id);
  if (!can(permissions, "invite")) {
    return NextResponse.json({ error: "You can't view invites for this room." }, { status: 403 });
  }

  const invites = await db.select().from(roomInvites).where(eq(roomInvites.roomId, room.id));
  return NextResponse.json({ invites });
}

const createSchema = z.object({
  expiresInHours: z.number().positive().max(24 * 30).optional(),
  maxUses: z.number().int().positive().max(10000).optional(),
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
  if (!can(permissions, "invite")) {
    return NextResponse.json({ error: "You can't create invites for this room." }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid invite settings." }, { status: 400 });

  const [invite] = await db
    .insert(roomInvites)
    .values({
      id: nanoid(),
      roomId: room.id,
      code: nanoid(10),
      createdByUserId: identity.id,
      expiresAt: parsed.data.expiresInHours
        ? new Date(Date.now() + parsed.data.expiresInHours * 60 * 60 * 1000)
        : null,
      maxUses: parsed.data.maxUses ?? null,
    })
    .returning();

  return NextResponse.json({ invite }, { status: 201 });
}
