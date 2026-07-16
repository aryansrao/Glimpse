import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { postMedia, posts, users } from "@/db/schema";
import { autoTags } from "@/lib/auto-tags";
import { toPostView, type PostMediaView } from "@/lib/feed";
import { publicUserColumns } from "@/lib/social";

const IMAGE_DATA_URL_PREFIX = "data:image/webp;base64,";
const MAX_MEDIA_ITEMS = 4;
const MAX_IMAGE_BYTES = 800 * 1024; // 800KB decoded
const MAX_AV_BYTES = 8 * 1024 * 1024; // 8MB decoded for video/pdf
// 8MB of binary is ~11.2M base64 chars; this is the backstop.
const MAX_BASE64_LENGTH = 11_200_000;

/** Accepted data-URL prefixes per media type, with blob file extension. */
const ACCEPTED: Record<
  "image" | "video" | "pdf",
  { prefix: string; contentType: string; ext: string; maxBytes: number }[]
> = {
  image: [
    {
      prefix: IMAGE_DATA_URL_PREFIX,
      contentType: "image/webp",
      ext: "webp",
      maxBytes: MAX_IMAGE_BYTES,
    },
  ],
  video: [
    {
      prefix: "data:video/mp4;base64,",
      contentType: "video/mp4",
      ext: "mp4",
      maxBytes: MAX_AV_BYTES,
    },
    {
      prefix: "data:video/webm;base64,",
      contentType: "video/webm",
      ext: "webm",
      maxBytes: MAX_AV_BYTES,
    },
  ],
  pdf: [
    {
      prefix: "data:application/pdf;base64,",
      contentType: "application/pdf",
      ext: "pdf",
      maxBytes: MAX_AV_BYTES,
    },
  ],
};

const mediaItemSchema = z.object({
  dataBase64: z.string().min(1).max(MAX_BASE64_LENGTH),
  type: z.enum(["image", "video", "pdf"]),
  fileName: z.string().trim().max(255).optional(),
});

const schema = z
  .object({
    body: z.string().trim().max(2000).optional(),
    /** Multi-media attachments, in display order. Max 4. */
    media: z.array(mediaItemSchema).max(MAX_MEDIA_ITEMS).optional(),
    /** Legacy single-image fields — treated as a one-item media array. */
    mediaBase64: z
      .string()
      .startsWith(IMAGE_DATA_URL_PREFIX)
      .max(MAX_BASE64_LENGTH)
      .optional(),
    mediaType: z.enum(["image"]).optional(),
  })
  .refine((d) => !!d.body || !!d.mediaBase64 || (d.media?.length ?? 0) > 0, {
    message: "A post needs text or media.",
  });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to post." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid post." },
      { status: 400 }
    );
  }

  // Normalize: legacy mediaBase64 becomes a single-item media array.
  const items =
    parsed.data.media ??
    (parsed.data.mediaBase64
      ? [{ dataBase64: parsed.data.mediaBase64, type: "image" as const }]
      : []);

  // Validate + decode every item before touching storage.
  const decoded: {
    buffer: Buffer;
    dataBase64: string;
    type: "image" | "video" | "pdf";
    fileName: string | null;
    contentType: string;
    ext: string;
  }[] = [];
  for (const item of items) {
    const accepted = ACCEPTED[item.type].find((a) =>
      item.dataBase64.startsWith(a.prefix)
    );
    if (!accepted) {
      return NextResponse.json(
        {
          error:
            item.type === "image"
              ? "Images must be WebP data URLs."
              : item.type === "video"
                ? "Videos must be MP4 or WebM data URLs."
                : "PDFs must be application/pdf data URLs.",
        },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(
      item.dataBase64.slice(accepted.prefix.length),
      "base64"
    );
    if (buffer.length === 0 || buffer.length > accepted.maxBytes) {
      return NextResponse.json(
        {
          error:
            item.type === "image"
              ? "Post images must be between 1 byte and 800KB."
              : `Post ${item.type === "pdf" ? "PDFs" : "videos"} must be between 1 byte and 8MB.`,
        },
        { status: 400 }
      );
    }
    decoded.push({
      buffer,
      dataBase64: item.dataBase64,
      type: item.type,
      fileName: item.fileName?.trim() || null,
      contentType: accepted.contentType,
      ext: accepted.ext,
    });
  }

  // Upload everything to Vercel Blob. Data-URL fallback is only viable
  // for small images; videos/PDFs are too big to store in the DB.
  const uploaded: PostMediaView[] = [];
  for (const item of decoded) {
    let url: string;
    try {
      const blob = await put(
        `posts/${session.user.id}/${nanoid()}.${item.ext}`,
        item.buffer,
        {
          access: "public",
          addRandomSuffix: false,
          contentType: item.contentType,
        }
      );
      url = blob.url;
    } catch {
      if (item.type === "image" && item.buffer.length <= MAX_IMAGE_BYTES) {
        // No Blob token configured — store the data URL directly.
        url = item.dataBase64;
      } else {
        return NextResponse.json(
          { error: "Media uploads aren't available right now." },
          { status: 503 }
        );
      }
    }
    uploaded.push({ url, type: item.type, fileName: item.fileName });
  }

  const [me] = await db
    .select(publicUserColumns)
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!me) {
    return NextResponse.json({ error: "Sign in to post." }, { status: 401 });
  }

  const body = parsed.data.body || null;
  const first = uploaded[0] ?? null;
  const tags = autoTags({
    body: body ?? undefined,
    fileNames: decoded.flatMap((m) => (m.fileName ? [m.fileName] : [])),
    mediaTypes: decoded.map((m) => m.type),
  });

  const [post] = await db
    .insert(posts)
    .values({
      id: nanoid(),
      userId: session.user.id,
      body,
      // Legacy single-media columns mirror the first attachment. The
      // posts.mediaType enum has no "pdf", so PDF-first posts store null.
      mediaUrl: first?.url ?? null,
      mediaType: first && first.type !== "pdf" ? first.type : null,
      tags: JSON.stringify(tags),
    })
    .returning();

  if (uploaded.length > 0) {
    await db.insert(postMedia).values(
      uploaded.map((m, position) => ({
        id: nanoid(),
        postId: post.id,
        url: m.url,
        type: m.type,
        fileName: m.fileName,
        position,
      }))
    );
  }

  const mediaByPostId = new Map([[post.id, uploaded]]);
  return NextResponse.json(
    { post: toPostView({ ...post, user: me }, new Set(), mediaByPostId) },
    { status: 201 }
  );
}
