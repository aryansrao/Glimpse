import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { auth } from "@/auth";
import { getDmThread, isThreadMember } from "@/lib/social";

const MAX_BYTES = 8 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

function resolveMedia(file: File): { mediaType: "image" | "video"; ext: string } | null {
  if (file.type === "video/mp4" || file.type === "video/webm") {
    return { mediaType: "video", ext: EXT_BY_MIME[file.type] };
  }
  if (file.type.startsWith("image/")) {
    const ext =
      EXT_BY_MIME[file.type] ?? file.name.split(".").pop()?.toLowerCase() ?? "img";
    return { mediaType: "image", ext };
  }
  return null;
}

/** Upload an image/video attachment for a DM thread (members only, ≤8MB). */
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

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 8MB)." }, { status: 400 });
  }

  const media = resolveMedia(file);
  if (!media) {
    return NextResponse.json(
      { error: "Only images, MP4 and WebM videos are supported." },
      { status: 400 }
    );
  }

  const blob = await put(`dms/${threadId}/${nanoid()}.${media.ext}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  return NextResponse.json({ url: blob.url, mediaType: media.mediaType });
}
