import { NextResponse } from "next/server";
import { hash, compare } from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, emailOtps } from "@/db/schema";

const MAX_ATTEMPTS = 5;

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { email, code, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    return NextResponse.json({ error: "No account found with this email." }, { status: 404 });
  }

  const [otp] = await db
    .select()
    .from(emailOtps)
    .where(eq(emailOtps.userId, user.id))
    .orderBy(desc(emailOtps.createdAt))
    .limit(1);

  if (!otp) {
    return NextResponse.json(
      { error: "No reset pending — request a new code." },
      { status: 400 }
    );
  }

  if (otp.expiresAt.getTime() < Date.now()) {
    await db.delete(emailOtps).where(eq(emailOtps.id, otp.id));
    return NextResponse.json(
      { error: "That code expired — request a new one." },
      { status: 400 }
    );
  }

  if (otp.attempts >= MAX_ATTEMPTS) {
    await db.delete(emailOtps).where(eq(emailOtps.id, otp.id));
    return NextResponse.json(
      { error: "Too many attempts — request a new reset code." },
      { status: 429 }
    );
  }

  // Record attempt
  await db
    .update(emailOtps)
    .set({ attempts: otp.attempts + 1 })
    .where(eq(emailOtps.id, otp.id));

  if (!(await compare(code, otp.codeHash))) {
    const remaining = MAX_ATTEMPTS - otp.attempts - 1;
    return NextResponse.json(
      {
        error:
          remaining > 0
            ? `Wrong code — ${remaining} ${remaining === 1 ? "try" : "tries"} left.`
            : "Wrong code — request a new one.",
      },
      { status: 400 }
    );
  }

  // Success: update password and delete OTP record. Also set emailVerified = true since they just verified via OTP.
  const passwordHash = await hash(password, 12);
  await db
    .update(users)
    .set({ passwordHash, emailVerified: true })
    .where(eq(users.id, user.id));

  await db.delete(emailOtps).where(eq(emailOtps.userId, user.id));

  return NextResponse.json({ ok: true });
}
