import { NextResponse } from "next/server";
import { sendKeepAliveEmail } from "@/lib/mailer";

export async function GET(req: Request) {
  // Verify Vercel Cron header to protect the endpoint from public spamming
  const authHeader = req.headers.get("Authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    await sendKeepAliveEmail("aryansrao.01@gmail.com");
    return NextResponse.json({ ok: true, message: "Keep-alive email sent to aryansrao.01@gmail.com" });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to send keep-alive email: " + errorMsg }, { status: 500 });
  }
}
