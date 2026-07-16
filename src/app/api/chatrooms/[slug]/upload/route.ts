import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";
import { resolveIdentity } from "@/lib/identity";
import { can, getMemberPermissions, getRoomBySlug } from "@/lib/chatroom";

const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED: Record<string, "image" | "video" | "file"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/gif": "image",
  "image/webp": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "application/pdf": "file",
  "application/msword": "file",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "file",
  "text/plain": "file",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const room = await getRoomBySlug(slug);
  if (!room) return NextResponse.json({ error: "Room not found." }, { status: 404 });

  const identity = await resolveIdentity();
  const { member, permissions } = await getMemberPermissions(room.id, identity.id);
  if (!member) return NextResponse.json({ error: "You're not a member of this room." }, { status: 403 });
  if (!can(permissions, "send_media")) {
    return NextResponse.json({ error: "You can't send media in this room." }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is too large (max 15MB)." }, { status: 400 });
  }
  const mediaType = ALLOWED[file.type];
  if (!mediaType) {
    return NextResponse.json({ error: "That file type isn't supported." }, { status: 400 });
  }

  const blob = await put(`chatrooms/${room.id}/${nanoid()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  return NextResponse.json({ url: blob.url, mediaType });
}
