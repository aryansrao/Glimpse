import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";

import { randomInt } from "node:crypto";
import { sendOtpEmail } from "@/lib/mailer";
import { emailOtps } from "@/db/schema";

const OTP_TTL_MS = 10 * 60 * 1000;

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
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
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

  const { username, name, password, email } = parsed.data;

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

  const userId = nanoid();
  const passwordHash = await hash(password, 12);

  // 1. Create the user with emailVerified = false
  await db.insert(users).values({
    id: userId,
    email,
    emailVerified: false,
    name,
    handle: username,
    passwordHash,
  });

  // 2. Generate, hash, and store the OTP
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await hash(code, 10);

  await db.insert(emailOtps).values({
    id: nanoid(),
    userId,
    email,
    codeHash,
    attempts: 0,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  try {
    await sendOtpEmail(email, code);
  } catch {
    // If mail sending fails, delete the created user and OTP to allow retry
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(emailOtps).where(eq(emailOtps.userId, userId));
    return NextResponse.json(
      { error: "Failed to send verification email. Please check your email address and try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, email }, { status: 201 });
}
