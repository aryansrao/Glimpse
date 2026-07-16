import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, emailOtps } from "@/db/schema";
import { isPlaceholderEmail } from "@/lib/mailer";

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

const patchSchema = z.object({
  name: z.string().trim().min(1, "Name can't be empty").max(50).optional(),
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(HANDLE_RE, "Usernames are 3-20 characters: a-z, 0-9, underscores")
    .optional(),
  bio: z.string().trim().max(300, "Bio can be at most 300 characters").optional(),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(24))
    .max(8, "Up to 8 tags")
    .optional(),
  isPublic: z.boolean().optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("That doesn't look like an email address")
    .max(254)
    .optional(),
});

function parseTags(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function serializeProfile(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    handle: user.handle,
    bio: user.bio ?? "",
    tags: parseTags(user.tags),
    isPublic: user.isPublic,
    email: user.email,
    emailIsPlaceholder: isPlaceholderEmail(user.email),
    emailVerified: user.emailVerified,
    discordLinked: Boolean(user.discordId),
    githubLinked: Boolean(user.githubId),
    hasPassword: Boolean(user.passwordHash),
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  return NextResponse.json(serializeProfile(user));
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const { name, handle, bio, tags, isPublic, email } = parsed.data;
  const updates: Partial<typeof users.$inferInsert> = {};

  if (name !== undefined) updates.name = name;
  if (bio !== undefined) updates.bio = bio || null;
  if (isPublic !== undefined) updates.isPublic = isPublic;

  // Interests auto-include #hashtags written in the bio, merged with any
  // explicitly managed tags, capped at 8.
  if (tags !== undefined || bio !== undefined) {
    const manual = tags ?? parseTags(user.tags);
    const bioText = bio !== undefined ? bio : (user.bio ?? "");
    const bioTags = [
      ...new Set(
        (bioText.match(/#([\p{L}\p{N}_-]{2,24})/gu) ?? []).map((m) =>
          m.slice(1).toLowerCase()
        )
      ),
    ];
    const merged = [...new Set([...manual, ...bioTags])].slice(0, 8);
    updates.tags = JSON.stringify(merged);
  }

  if (handle !== undefined && handle !== user.handle) {
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.handle, handle), ne(users.id, user.id)));
    if (taken) {
      return NextResponse.json(
        { error: "That username is already taken." },
        { status: 409 }
      );
    }
    updates.handle = handle;
  }

  let emailChanged = false;
  if (email !== undefined && email !== user.email) {
    if (isPlaceholderEmail(email)) {
      return NextResponse.json(
        { error: "That doesn't look like an email address." },
        { status: 400 }
      );
    }
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, user.id)));
    if (taken) {
      return NextResponse.json(
        { error: "That email is already in use by another account." },
        { status: 409 }
      );
    }
    updates.email = email;
    updates.emailVerified = false;
    emailChanged = true;
  }

  if (Object.keys(updates).length > 0) {
    try {
      await db.update(users).set(updates).where(eq(users.id, user.id));
    } catch (err) {
      // Unique index race — someone claimed the handle/email between our
      // check and the write.
      if (err instanceof Error && /unique/i.test(err.message)) {
        return NextResponse.json(
          { error: "That username or email is already taken." },
          { status: 409 }
        );
      }
      throw err;
    }
    if (emailChanged) {
      // Any pending code was sent to the old address — invalidate it.
      await db.delete(emailOtps).where(eq(emailOtps.userId, user.id));
    }
  }

  const [updated] = await db.select().from(users).where(eq(users.id, user.id));
  return NextResponse.json(serializeProfile(updated ?? user));
}
