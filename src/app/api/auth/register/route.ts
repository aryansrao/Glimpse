import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9_]{3,20}$/,
      "Username must be 3-20 characters: letters, numbers, underscores"
    ),
  name: z.string().trim().min(1).max(50),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { username, name, password } = parsed.data;
  const email = parsed.data.email || `${username}@accounts.glimpse`;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.handle, username), eq(users.email, email)));
  if (existing) {
    return NextResponse.json(
      { error: "That username or email is already taken" },
      { status: 409 }
    );
  }

  const passwordHash = await hash(password, 12);
  await db.insert(users).values({
    id: nanoid(),
    email,
    emailVerified: false,
    name,
    handle: username,
    passwordHash,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
