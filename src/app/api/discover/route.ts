import { NextResponse } from "next/server";
import { and, eq, like, or } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { parseTags, tagSimilarity } from "@/lib/social";

const RESULT_LIMIT = 50;
// Rank over a wider pool than we return so similarity ordering is meaningful.
const CANDIDATE_POOL = 200;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to browse people." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const tag = searchParams.get("tag")?.trim() ?? "";
  const similarOnly = searchParams.get("similar") === "1";

  const conditions = [eq(users.isPublic, true)];
  if (q) {
    conditions.push(
      or(like(users.name, `%${q}%`), like(users.handle, `%${q}%`), like(users.bio, `%${q}%`))!
    );
  }
  if (tag) {
    conditions.push(like(users.tags, `%"${tag}"%`));
  }

  const [me] = await db
    .select({ tags: users.tags })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  const myTags = parseTags(me?.tags);

  const rows = await db
    .select({
      id: users.id,
      handle: users.handle,
      name: users.name,
      bio: users.bio,
      tags: users.tags,
      avatarWebpBase64: users.avatarWebpBase64,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(...conditions))
    .limit(CANDIDATE_POOL);

  const results = rows
    .filter((row) => row.id !== session.user.id)
    .map((row) => {
      const candidateTags = parseTags(row.tags);
      const { score, sharedTags } = tagSimilarity(myTags, candidateTags);
      return {
        id: row.id,
        handle: row.handle,
        name: row.name,
        bio: row.bio,
        tags: candidateTags,
        avatarWebpBase64: row.avatarWebpBase64,
        sharedTags,
        score,
        createdAt: row.createdAt,
      };
    })
    .filter((row) => (similarOnly ? row.score > 0 : true))
    .sort((a, b) => b.score - a.score || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, RESULT_LIMIT)
    .map(({ createdAt: _createdAt, ...rest }) => rest);

  return NextResponse.json({ results });
}
