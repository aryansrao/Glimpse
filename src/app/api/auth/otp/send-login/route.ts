import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { hash } from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { users, emailOtps } from "@/db/schema";
import { isEmailConfigured, sendLoginOtpEmail } from "@/lib/mailer";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("email" in body)) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const email = String(body.email).trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: "Email sending isn't configured yet." },
      { status: 503 }
    );
  }

  // Rate limit: one code per 60 seconds by email
  const [latest] = await db
    .select({ createdAt: emailOtps.createdAt })
    .from(emailOtps)
    .where(eq(emailOtps.email, email))
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

  // Clear previous OTPs for this email address
  await db.delete(emailOtps).where(eq(emailOtps.email, email));

  // Find user to associate or set association to empty for new registration
  const [user] = await db.select().from(users).where(eq(users.email, email));

  await db.insert(emailOtps).values({
    id: nanoid(),
    userId: user?.id ?? "",
    email,
    codeHash,
    attempts: 0,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });

  try {
    await sendLoginOtpEmail(email, code);
  } catch {
    await db.delete(emailOtps).where(eq(emailOtps.email, email));
    return NextResponse.json(
      { error: "Couldn't send the email. Please try again later." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
