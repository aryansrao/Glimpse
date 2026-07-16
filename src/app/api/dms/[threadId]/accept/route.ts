import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmThreads } from "@/db/schema";
import { getDmThread, isThreadMember } from "@/lib/social";

/** Recipient accepts a message request → the thread becomes a normal chat. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { threadId } = await params;
  const thread = await getDmThread(threadId);
  if (!thread) {
    return NextResponse.json({ error: "That conversation doesn't exist." }, { status: 404 });
  }
  if (!isThreadMember(thread, session.user.id)) {
    return NextResponse.json({ error: "Not your conversation." }, { status: 403 });
  }
  if (thread.state === "accepted") {
    return NextResponse.json({ ok: true, state: "accepted" });
  }
  // Only the request recipient (non-initiator) may accept.
  if (thread.initiatorId === session.user.id) {
    return NextResponse.json(
      { error: "Only the recipient can accept a request." },
      { status: 403 }
    );
  }

  await db.update(dmThreads).set({ state: "accepted" }).where(eq(dmThreads.id, threadId));
  return NextResponse.json({ ok: true, state: "accepted" });
}
