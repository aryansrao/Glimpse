import { NextResponse } from "next/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { confessions, confessionMessages } from "@/db/schema";
import { LIST_LIMIT } from "@/lib/social";

function parseBefore(raw: string | null): Date | null {
  if (!raw) return null;
  const asNumber = Number(raw);
  const date = Number.isFinite(asNumber) && raw.trim() !== "" ? new Date(asNumber) : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

type MessageRow = typeof confessionMessages.$inferSelect;

function serialize(m: MessageRow) {
  return {
    id: m.id,
    fromOwner: m.fromOwner,
    body: m.body,
    createdAt: m.createdAt,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const { id } = await params;

  const [confession] = await db
    .select()
    .from(confessions)
    .where(eq(confessions.id, id))
    .limit(1);

  if (!confession) {
    return NextResponse.json({ error: "That confession doesn't exist." }, { status: 404 });
  }

  // Access control: recipient (toUserId) or the anonymous sender (senderUserId) only.
  // Anonymous guests can't view threads.
  const isRecipient = session?.user?.id === confession.toUserId;
  const isSender = session?.user?.id === confession.senderUserId;
  if (!isRecipient && !isSender) {
    return NextResponse.json({ error: "Not your confession." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || LIST_LIMIT, 1), LIST_LIMIT);
  const before = parseBefore(searchParams.get("before"));

  const filters = [eq(confessionMessages.confessionId, id)];
  if (before) filters.push(lt(confessionMessages.createdAt, before));

  const rows = await db
    .select()
    .from(confessionMessages)
    .where(and(...filters))
    .orderBy(desc(confessionMessages.createdAt))
    .limit(limit);

  return NextResponse.json({
    /**
     * Which side of the thread the caller is. The sender's identity is
     * never revealed to the recipient — only a role for rendering.
     */
    role: isRecipient ? ("recipient" as const) : ("sender" as const),
    confession: {
      id: confession.id,
      body: confession.body,
      createdAt: confession.createdAt,
    },
    messages: rows.reverse().map(serialize),
  });
}

const postSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to reply to confessions." }, { status: 401 });
  }

  const { id } = await params;

  const [confession] = await db
    .select()
    .from(confessions)
    .where(eq(confessions.id, id))
    .limit(1);

  if (!confession) {
    return NextResponse.json({ error: "That confession doesn't exist." }, { status: 404 });
  }

  // Access control: recipient or the anonymous sender only.
  const isRecipient = session.user.id === confession.toUserId;
  const isSender = session.user.id === confession.senderUserId;
  if (!isRecipient && !isSender) {
    return NextResponse.json({ error: "Not your confession." }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Message can't be empty." },
      { status: 400 }
    );
  }

  const [message] = await db
    .insert(confessionMessages)
    .values({
      id: nanoid(),
      confessionId: id,
      fromOwner: isRecipient,
      body: parsed.data.body,
      createdAt: new Date(),
    })
    .returning();

  // Bump the lastMessageAt timestamp.
  if (message) {
    await db
      .update(confessions)
      .set({ lastMessageAt: message.createdAt })
      .where(eq(confessions.id, id));
  }

  return NextResponse.json(serialize(message), { status: 201 });
}
