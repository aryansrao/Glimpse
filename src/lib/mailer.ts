import nodemailer from "nodemailer";

/**
 * Transactional email (OTP verification codes) with a provider switch:
 *
 *   1. RESEND_API_KEY set  → Resend HTTP API (no SMTP needed, free tier)
 *   2. SMTP_HOST set       → nodemailer over SMTP (Brevo, Gmail app password, …)
 *   3. neither             → sendOtpEmail() throws "email not configured"
 *
 * See .env.example for the relevant variables.
 */

/** Synthetic addresses we mint for accounts without a real email. */
export function isPlaceholderEmail(email: string): boolean {
  return /@[a-z0-9-]+\.glimpse$/i.test(email);
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
}

type OtpMessage = {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
};

function buildOtpMessage(to: string, code: string, from: string): OtpMessage {
  return {
    to,
    from: from.includes("<") ? from : `Glimpse <${from}>`,
    subject: `${code} is your Glimpse verification code`,
    text: [
      `Your Glimpse verification code is: ${code}`,
      "",
      "It expires in 10 minutes. If you didn't request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0c;color:#f4f4f5;padding:40px 24px;border-radius:16px;max-width:480px;margin:0 auto;">
        <p style="margin:0 0 8px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;">Glimpse</p>
        <h1 style="margin:0 0 24px;font-size:20px;font-weight:500;">Verify your email</h1>
        <p style="margin:0 0 16px;font-size:14px;color:#d4d4d8;">Enter this code on your profile page:</p>
        <p style="margin:0 0 24px;font-size:34px;font-weight:600;letter-spacing:0.3em;color:#ffffff;">${code}</p>
        <p style="margin:0;font-size:12px;color:#9ca3af;">This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.</p>
      </div>
    `,
  };
}

async function sendViaResend(message: OtpMessage): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body.slice(0, 300)}`);
  }
}

async function sendViaSmtp(message: OtpMessage): Promise<void> {
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // Port 465 is implicit TLS; 587/25 use STARTTLS.
    secure: port === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  await transport.sendMail(message);
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    const from = process.env.RESEND_FROM || "Glimpse <onboarding@resend.dev>";
    await sendViaResend(buildOtpMessage(to, code, from));
    return;
  }
  if (process.env.SMTP_HOST) {
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || "glimpse@localhost";
    await sendViaSmtp(buildOtpMessage(to, code, from));
    return;
  }
  throw new Error(
    "Email is not configured — set RESEND_API_KEY (Resend) or SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM in your environment."
  );
}
