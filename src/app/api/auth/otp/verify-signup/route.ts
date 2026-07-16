import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, emailOtps } from "@/db/schema";

const MAX_ATTEMPTS = 5;

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
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
    return NextResponse.json({ error: "Enter a valid email and 6-digit code." }, { status: 400 });
  }

  const { email, code } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) {
    return NextResponse.json({ error: "No account found with this email." }, { status: 404 });
  }

  if (user.emailVerified) {
    return NextResponse.json({ error: "Your email is already verified. Please sign in." }, { status: 400 });
  }

  const [otp] = await db
    .select()
    .from(emailOtps)
    .where(eq(emailOtps.userId, user.id))
    .orderBy(desc(emailOtps.createdAt))
    .limit(1);

  if (!otp) {
    return NextResponse.json(
      { error: "No verification code pending — request a new one." },
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
      { error: "Too many attempts — request a new code." },
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

  // Mark user verified and clear verification code
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id));
  await db.delete(emailOtps).where(eq(emailOtps.userId, user.id));

  return NextResponse.json({ ok: true, emailVerified: true });
}
