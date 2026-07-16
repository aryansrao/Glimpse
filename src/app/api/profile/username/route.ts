import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

/** GET /api/profile/username?check=<handle> → { available: boolean } */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const handle = (new URL(req.url).searchParams.get("check") ?? "")
    .trim()
    .toLowerCase();

  if (!HANDLE_RE.test(handle)) {
    return NextResponse.json({ available: false, valid: false });
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, handle));

  // Your own current handle counts as available (no-op rename).
  const available = !existing || existing.id === session.user.id;
  return NextResponse.json({ available, valid: true });
}
