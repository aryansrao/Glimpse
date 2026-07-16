import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { dmThreads, users } from "@/db/schema";

/** Hard cap on every social list endpoint. */
export const LIST_LIMIT = 50;

/**
 * Public-safe projection of a user for social payloads. Never widen this
 * to include email or other private columns.
 */
export const publicUserColumns = {
  id: users.id,
  handle: users.handle,
  name: users.name,
  avatarWebpBase64: users.avatarWebpBase64,
};

export type PublicUser = {
  id: string;
  handle: string;
  name: string;
  avatarWebpBase64: string | null;
};

/** Defensively parse a JSON-encoded string[] column (users.tags etc.). */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === "string");
  } catch {
    return [];
  }
}

function normalizeTags(tags: string[]): Set<string> {
  return new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean));
}

/**
 * Jaccard similarity between two tag lists (|intersection| / |union|),
 * case-insensitive. 0 if either side is empty. Also returns the shared
 * tags, spelled as they appear in `a`.
 */
export function tagSimilarity(
  a: string[],
  b: string[]
): { score: number; sharedTags: string[] } {
  const setA = normalizeTags(a);
  const setB = normalizeTags(b);
  if (setA.size === 0 || setB.size === 0) return { score: 0, sharedTags: [] };

  const seen = new Set<string>();
  const sharedTags: string[] = [];
  for (const tag of a) {
    const key = tag.trim().toLowerCase();
    if (key && setB.has(key) && !seen.has(key)) {
      seen.add(key);
      sharedTags.push(tag.trim());
    }
  }

  const union = setA.size + setB.size - seen.size;
  return { score: union === 0 ? 0 : seen.size / union, sharedTags };
}

/** Canonical DM pair key — lower user id lexicographically first. */
export function sortedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * Get or lazily create the DM thread between two users. The pair is
 * stored sorted so the unique index makes this race-safe.
 */
export async function getOrCreateDmThread(userId: string, otherUserId: string) {
  const [userAId, userBId] = sortedPair(userId, otherUserId);
  const pairFilter = and(eq(dmThreads.userAId, userAId), eq(dmThreads.userBId, userBId));

  const [existing] = await db.select().from(dmThreads).where(pairFilter).limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(dmThreads)
    .values({ id: nanoid(), userAId, userBId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost a creation race — the other insert won, so read it back.
  const [row] = await db.select().from(dmThreads).where(pairFilter).limit(1);
  return row;
}

/** Fetch a DM thread by id, or null. */
export async function getDmThread(threadId: string) {
  const [thread] = await db
    .select()
    .from(dmThreads)
    .where(eq(dmThreads.id, threadId))
    .limit(1);
  return thread ?? null;
}

export function isThreadMember(
  thread: { userAId: string; userBId: string },
  userId: string
): boolean {
  return thread.userAId === userId || thread.userBId === userId;
}
