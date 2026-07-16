import { NextResponse } from "next/server";
import { and, desc, eq, like, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { chatRooms, roomMembers, roomRoles } from "@/db/schema";
import { auth } from "@/auth";
import { resolveIdentity } from "@/lib/identity";
import { slugify } from "@/lib/chatroom";
import { DEFAULT_ROLE_PERMISSIONS, OWNER_ROLE_PERMISSIONS } from "@/lib/permissions";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const tag = searchParams.get("tag")?.trim();

  const filters = [eq(chatRooms.visibility, "public")];
  if (q) {
    filters.push(
      or(
        like(chatRooms.name, `%${q}%`),
        like(chatRooms.topic, `%${q}%`),
        like(chatRooms.tags, `%${q}%`)
      )!
    );
  }
  if (tag) {
    filters.push(like(chatRooms.tags, `%"${tag}"%`));
  }

  const rows = await db
    .select()
    .from(chatRooms)
    .where(and(...filters))
    .orderBy(desc(chatRooms.memberCount), desc(chatRooms.createdAt))
    .limit(60);

  return NextResponse.json({
    rooms: rows.map((r) => ({ ...r, tags: JSON.parse(r.tags) as string[] })),
  });
}

/** Either a short emoji/text icon or a compressed WebP data URL upload. */
const iconSchema = z
  .string()
  .trim()
  .refine(
    (v) =>
      v.length <= 8 ||
      (v.startsWith("data:image/webp;base64,") && v.length <= 80_000),
    "Icon must be a short emoji or an uploaded image"
  );

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional(),
  icon: iconSchema.optional(),
  topic: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
  visibility: z.enum(["public", "private"]).default("public"),
});

export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid room details." }, { status: 400 });
  }
  const data = parsed.data;

  const session = await auth();
  if (data.visibility === "private" && !session?.user) {
    return NextResponse.json(
      { error: "Sign in to create a private room." },
      { status: 401 }
    );
  }

  const identity = session?.user
    ? { id: session.user.id, isGuest: false }
    : await resolveIdentity();

  let slug = slugify(data.name);
  for (let attempt = 0; attempt < 5; attempt++) {
    const [clash] = await db.select().from(chatRooms).where(eq(chatRooms.slug, slug)).limit(1);
    if (!clash) break;
    slug = `${slugify(data.name)}-${nanoid(5).toLowerCase()}`;
  }

  const roomId = nanoid();
  await db.insert(chatRooms).values({
    id: roomId,
    slug,
    name: data.name,
    description: data.description ?? null,
    icon: data.icon ?? null,
    topic: data.topic ?? null,
    tags: JSON.stringify(data.tags),
    visibility: data.visibility,
    ownerUserId: identity.id,
    memberCount: 1,
  });

  const ownerRoleId = nanoid();
  const memberRoleId = nanoid();
  await db.insert(roomRoles).values([
    {
      id: ownerRoleId,
      roomId,
      name: "Owner",
      color: "#8b7fff",
      permissions: JSON.stringify(OWNER_ROLE_PERMISSIONS),
      position: 100,
      isDefault: false,
    },
    {
      id: memberRoleId,
      roomId,
      name: "Member",
      color: "#d4d4d4",
      permissions: JSON.stringify(DEFAULT_ROLE_PERMISSIONS),
      position: 0,
      isDefault: true,
    },
  ]);

  await db.insert(roomMembers).values({
    id: nanoid(),
    roomId,
    userId: identity.id,
    roleId: ownerRoleId,
    isOwner: true,
  });

  return NextResponse.json({ slug }, { status: 201 });
}
