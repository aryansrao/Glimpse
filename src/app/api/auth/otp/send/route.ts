import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { hash } from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, emailOtps } from "@/db/schema";
import { isEmailConfigured, isPlaceholderEmail, sendOtpEmail } from "@/lib/mailer";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

/** POST /api/auth/otp/send — email a fresh 6-digit code to the signed-in user. */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id));
  if (!user) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }
  if (isPlaceholderEmail(user.email)) {
    return NextResponse.json(
      { error: "Add a real email address to your profile first." },
      { status: 400 }
    );
  }
  if (user.emailVerified) {
    return NextResponse.json(
      { error: "Your email is already verified." },
      { status: 400 }
    );
  }
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email sending isn't configured yet." },
      { status: 503 }
    );
  }

  // Rate limit: one code per 60 seconds.
  const [latest] = await db
    .select({ createdAt: emailOtps.createdAt })
    .from(emailOtps)
    .where(eq(emailOtps.userId, user.id))
    .orderBy(desc(emailOtps.createdAt))
    .limit(1);
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime())) / 1000
    );
    return NextResponse.json(
      { error: `Please wait ${wait}s before requesting another code.` },
      { status: 429 }
    );
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await hash(code, 10);

  await db.delete(emailOtps).where(eq(emailOtps.userId, user.id));
  await db.insert(emailOtps).values({
    id: nanoid(),
    userId: user.id,
    email: user.email,
    codeHash,
    attempts: 0,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  try {
    await sendOtpEmail(user.email, code);
  } catch {
    // Don't leave a live code around if delivery failed.
    await db.delete(emailOtps).where(eq(emailOtps.userId, user.id));
    return NextResponse.json(
      { error: "Couldn't send the email — check the SMTP settings and try again." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
