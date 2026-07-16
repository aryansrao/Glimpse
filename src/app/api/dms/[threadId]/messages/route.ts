import { NextResponse } from "next/server";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { dmMessages, dmReactions, dmThreads } from "@/db/schema";
import { getDmThread, isThreadMember, LIST_LIMIT } from "@/lib/social";

/** `before` accepts an ISO date string or a millisecond epoch. */
function parseBefore(raw: string | null): Date | null {
  if (!raw) return null;
  const asNumber = Number(raw);
  const date = Number.isFinite(asNumber) && raw.trim() !== "" ? new Date(asNumber) : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

type ReplyPreview = { id: string; body: string | null; senderId: string; mediaType: string | null };
type Reaction = { emoji: string; userId: string };

function serialize(
  m: typeof dmMessages.$inferSelect,
  replyPreview: ReplyPreview | null = null,
  reactions: Reaction[] = []
) {
  return {
    id: m.id,
    senderId: m.senderId,
    body: m.body,
    mediaUrl: m.mediaUrl,
    mediaType: m.mediaType,
    replyToId: m.replyToId,
    replyPreview,
    reactions,
    createdAt: m.createdAt,
  };
}

export async function GET(
  req: Request,
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

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || LIST_LIMIT, 1), LIST_LIMIT);
  const before = parseBefore(searchParams.get("before"));

  const filters = [eq(dmMessages.threadId, threadId)];
  if (before) filters.push(lt(dmMessages.createdAt, before));

  const rows = await db
    .select()
    .from(dmMessages)
    .where(and(...filters))
    .orderBy(desc(dmMessages.createdAt))
    .limit(limit);

  const ids = rows.map((m) => m.id);
  const replyIds = [...new Set(rows.map((m) => m.replyToId).filter((id): id is string => !!id))];

  const [reactionRows, replyRows] = await Promise.all([
    ids.length
      ? db
          .select({
            messageId: dmReactions.messageId,
            emoji: dmReactions.emoji,
            userId: dmReactions.userId,
          })
          .from(dmReactions)
          .where(inArray(dmReactions.messageId, ids))
      : Promise.resolve([]),
    replyIds.length
      ? db
          .select({
            id: dmMessages.id,
            body: dmMessages.body,
            senderId: dmMessages.senderId,
            mediaType: dmMessages.mediaType,
          })
          .from(dmMessages)
          .where(and(eq(dmMessages.threadId, threadId), inArray(dmMessages.id, replyIds)))
      : Promise.resolve([]),
  ]);

  const reactionsByMessage = new Map<string, Reaction[]>();
  for (const r of reactionRows) {
    const list = reactionsByMessage.get(r.messageId) ?? [];
    list.push({ emoji: r.emoji, userId: r.userId });
    reactionsByMessage.set(r.messageId, list);
  }
  const replyById = new Map(replyRows.map((r) => [r.id, r]));

  return NextResponse.json({
    messages: rows
      .reverse()
      .map((m) =>
        serialize(
          m,
          (m.replyToId && replyById.get(m.replyToId)) || null,
          reactionsByMessage.get(m.id) ?? []
        )
      ),
    threadState: thread.state,
  });
}

const postSchema = z
  .object({
    body: z.string().trim().max(2000).optional(),
    mediaUrl: z.string().url().optional(),
    mediaType: z.enum(["image", "video", "file"]).optional(),
    replyToId: z.string().min(1).max(64).optional(),
  })
  .refine((d) => !!d.body || !!d.mediaUrl, { message: "Message can't be empty." });

export async function POST(
  req: Request,
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

  const parsed = postSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid message." },
      { status: 400 }
    );
  }

  // A reply must point at a message inside this same thread.
  let replyPreview: ReplyPreview | null = null;
  if (parsed.data.replyToId) {
    const [target] = await db
      .select({
        id: dmMessages.id,
        body: dmMessages.body,
        senderId: dmMessages.senderId,
        mediaType: dmMessages.mediaType,
      })
      .from(dmMessages)
      .where(and(eq(dmMessages.id, parsed.data.replyToId), eq(dmMessages.threadId, threadId)))
      .limit(1);
    if (!target) {
      return NextResponse.json(
        { error: "You can't reply to a message from another conversation." },
        { status: 400 }
      );
    }
    replyPreview = target;
  }

  const [message] = await db
    .insert(dmMessages)
    .values({
      id: nanoid(),
      threadId,
      senderId: session.user.id,
      body: parsed.data.body || null,
      mediaUrl: parsed.data.mediaUrl ?? null,
      mediaType: parsed.data.mediaUrl ? parsed.data.mediaType ?? "file" : null,
      replyToId: parsed.data.replyToId ?? null,
    })
    .returning();

  const patch: { lastMessageAt: Date; state?: "accepted" } = {
    lastMessageAt: message.createdAt,
  };
  // The request recipient replying accepts the request implicitly.
  if (
    thread.state === "request" &&
    thread.initiatorId &&
    thread.initiatorId !== session.user.id
  ) {
    patch.state = "accepted";
  }
  await db.update(dmThreads).set(patch).where(eq(dmThreads.id, threadId));

  return NextResponse.json(serialize(message, replyPreview), { status: 201 });
}
