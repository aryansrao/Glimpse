import { nanoid } from "nanoid";
import { and, eq, ne, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { queueEntries, type QueueEntry } from "@/db/schema";

export type Mode = "video" | "audio";

export const MIN_GROUP_SIZE = 2;
export const MAX_GROUP_SIZE = 6;

export function clampGroupSize(size: unknown): number {
  const n = typeof size === "number" && Number.isFinite(size) ? Math.round(size) : 2;
  return Math.min(MAX_GROUP_SIZE, Math.max(MIN_GROUP_SIZE, n));
}

/** LiveKit room name for a classic 1:1 queue match (kept identical to the old scheme). */
export function pairRoomName(a: string, b: string) {
  return `queue-${[a, b].sort().join("-")}`;
}

/** LiveKit room name for a 3-6 person group match; `groupKey` is the shared opaque key. */
export function groupRoomName(groupKey: string) {
  return `queue-grp-${groupKey}`;
}

/**
 * The LiveKit room a matched entry belongs to, or null if unmatched.
 * For pairs `matchedWithPeerId` holds the partner's peer id; for groups it
 * holds the shared group key that every member's row points at.
 */
export function roomNameForEntry(
  entry: Pick<QueueEntry, "peerId" | "matchedWithPeerId" | "groupSize">
): string | null {
  if (!entry.matchedWithPeerId) return null;
  return entry.groupSize > 2
    ? groupRoomName(entry.matchedWithPeerId)
    : pairRoomName(entry.peerId, entry.matchedWithPeerId);
}

/** Safely parses a JSON-encoded string[] column. */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const val = JSON.parse(raw);
    return Array.isArray(val) ? val.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

/** Deterministic similarity score: number of shared (case-insensitive) tags. */
export function sharedTagCount(mine: string[], theirs: string[]): number {
  if (mine.length === 0 || theirs.length === 0) return 0;
  const set = new Set(mine.map((t) => t.trim().toLowerCase()));
  let n = 0;
  for (const t of new Set(theirs.map((x) => x.trim().toLowerCase()))) {
    if (set.has(t)) n++;
  }
  return n;
}

/**
 * Orders waiting candidates: highest shared-tag score first, FIFO within
 * equal scores (candidates must already be in FIFO order).
 */
function rankCandidates(candidates: QueueEntry[], myTags: string[]): QueueEntry[] {
  return candidates
    .map((c, i) => ({ c, i, score: sharedTagCount(myTags, parseTags(c.tags)) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.c);
}

function joinNames(names: string[]): string {
  return names.join(", ");
}

export type JoinQueueResult =
  | { entryId: string; matched: false; groupSize: number }
  | {
      entryId: string;
      matched: true;
      roomName: string;
      partnerPeerId: string;
      partnerName: string;
      isInitiator: boolean;
      groupSize: number;
    };

/**
 * Joins the random-match queue.
 *
 * Pairs (groupSize 2): if a waiting searcher with the same mode + size
 * exists, the best-scoring one (shared tags, then FIFO) is claimed and both
 * rows become "matched"; the joiner is the call initiator.
 *
 * Groups (groupSize 3-6): once `groupSize - 1` waiting searchers with the
 * same mode + size exist, they are all claimed into one group. Every
 * member's `matchedWithPeerId` is set to the same opaque group key, so all
 * of them derive the same LiveKit room (`queue-grp-<key>`); the oldest
 * waiting entry becomes the initiator.
 */
export async function joinQueue(params: {
  peerId: string;
  displayName: string;
  userId?: string | null;
  mode: Mode;
  groupSize?: number;
  tags?: string[];
}): Promise<JoinQueueResult> {
  const { peerId, displayName, userId, mode } = params;
  const groupSize = clampGroupSize(params.groupSize ?? 2);
  const tags = params.tags ?? [];
  const tagsJson = JSON.stringify(tags);
  const myId = nanoid();
  const needed = groupSize - 1;

  const waiting = await db
    .select()
    .from(queueEntries)
    .where(
      and(
        eq(queueEntries.status, "waiting"),
        eq(queueEntries.mode, mode),
        eq(queueEntries.groupSize, groupSize),
        ne(queueEntries.peerId, peerId)
      )
    )
    .orderBy(asc(queueEntries.createdAt))
    .limit(32);

  if (waiting.length >= needed) {
    const ranked = rankCandidates(waiting, tags);

    if (groupSize === 2) {
      // Try candidates best-first; the conditional update guards against a
      // race where two simultaneous joiners see the same waiting row.
      for (const candidate of ranked) {
        const claimed = await db
          .update(queueEntries)
          .set({
            status: "matched",
            matchedWithPeerId: peerId,
            matchedWithName: displayName,
          })
          .where(
            and(eq(queueEntries.id, candidate.id), eq(queueEntries.status, "waiting"))
          )
          .returning();
        if (claimed.length === 0) continue;

        await db.insert(queueEntries).values({
          id: myId,
          peerId,
          displayName,
          userId: userId ?? null,
          mode,
          status: "matched",
          matchedWithPeerId: candidate.peerId,
          matchedWithName: candidate.displayName,
          isInitiator: true,
          groupSize,
          tags: tagsJson,
        });
        return {
          entryId: myId,
          matched: true,
          roomName: pairRoomName(peerId, candidate.peerId),
          partnerPeerId: candidate.peerId,
          partnerName: candidate.displayName,
          isInitiator: true,
          groupSize,
        };
      }
    } else {
      const groupKey = `g${nanoid(14)}`;
      const claimedRows: QueueEntry[] = [];

      for (const candidate of ranked) {
        if (claimedRows.length >= needed) break;
        const claimed = await db
          .update(queueEntries)
          .set({
            status: "matched",
            matchedWithPeerId: groupKey,
            // Placeholder until the full member list is known; the SSE
            // poller waits for a non-empty name on group entries.
            matchedWithName: "",
            isInitiator: false,
          })
          .where(
            and(eq(queueEntries.id, candidate.id), eq(queueEntries.status, "waiting"))
          )
          .returning();
        if (claimed.length > 0) claimedRows.push(claimed[0]);
      }

      if (claimedRows.length < needed) {
        // Lost too many races — release whoever we grabbed and wait instead.
        if (claimedRows.length > 0) {
          await db
            .update(queueEntries)
            .set({ status: "waiting", matchedWithPeerId: null, matchedWithName: null })
            .where(
              inArray(
                queueEntries.id,
                claimedRows.map((c) => c.id)
              )
            );
        }
      } else {
        // Full group: the oldest waiting entry is the initiator; each
        // member's matchedWithName lists everyone else in the call.
        const memberNames = new Map<string, string>([
          [myId, displayName],
          ...claimedRows.map((c) => [c.id, c.displayName] as [string, string]),
        ]);
        const oldest = claimedRows.reduce((a, b) =>
          a.createdAt.getTime() <= b.createdAt.getTime() ? a : b
        );

        for (const member of claimedRows) {
          const others = [...memberNames.entries()]
            .filter(([id]) => id !== member.id)
            .map(([, name]) => name);
          await db
            .update(queueEntries)
            .set({
              matchedWithName: joinNames(others),
              isInitiator: member.id === oldest.id,
            })
            .where(eq(queueEntries.id, member.id));
        }

        const myPartners = claimedRows.map((c) => c.displayName);
        await db.insert(queueEntries).values({
          id: myId,
          peerId,
          displayName,
          userId: userId ?? null,
          mode,
          status: "matched",
          matchedWithPeerId: groupKey,
          matchedWithName: joinNames(myPartners),
          isInitiator: false,
          groupSize,
          tags: tagsJson,
        });

        return {
          entryId: myId,
          matched: true,
          roomName: groupRoomName(groupKey),
          partnerPeerId: groupKey,
          partnerName: joinNames(myPartners),
          isInitiator: false,
          groupSize,
        };
      }
    }
  }

  await db.insert(queueEntries).values({
    id: myId,
    peerId,
    displayName,
    userId: userId ?? null,
    mode,
    status: "waiting",
    groupSize,
    tags: tagsJson,
  });

  return { entryId: myId, matched: false, groupSize };
}

export async function pollQueue(entryId: string) {
  const [entry] = await db.select().from(queueEntries).where(eq(queueEntries.id, entryId));
  if (!entry) return null;
  return entry;
}

export async function leaveQueue(entryId: string) {
  await db
    .update(queueEntries)
    .set({ status: "cancelled" })
    .where(and(eq(queueEntries.id, entryId), eq(queueEntries.status, "waiting")));
}
