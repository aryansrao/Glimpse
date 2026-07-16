import { createHmac, timingSafeEqual } from "crypto";
import { customAlphabet, nanoid } from "nanoid";

// No 0/O/1/I/L to avoid ambiguity when someone reads the code aloud.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const generateRoomCode = customAlphabet(ALPHABET, 6);

export const ROOM_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

/** Discord-style room capacity bounds; the row default is 8. */
export const MIN_ROOM_PARTICIPANTS = 2;
export const MAX_ROOM_PARTICIPANTS = 25;

function participantSig(code: string, nonce: string, hostToken: string): string {
  return createHmac("sha256", hostToken)
    .update(`${code.toUpperCase()}:${nonce}`)
    .digest("base64url")
    .slice(0, 24);
}

/**
 * Mints a stateless participant capability for a room: `p.<nonce>.<sig>`.
 * The sig is an HMAC keyed by the room's hostToken, so it can be verified
 * later from the DB row alone — no per-participant storage or schema change,
 * and unguessable without the host token. Every join gets a fresh nonce, so
 * any number of participants can hold independent tokens.
 */
export function mintParticipantToken(code: string, hostToken: string): string {
  const nonce = nanoid(10);
  return `p.${nonce}.${participantSig(code, nonce, hostToken)}`;
}

/**
 * Verifies a participant token for a room. Returns the token's unique nonce
 * (usable as a LiveKit identity suffix) or null if invalid.
 */
export function verifyParticipantToken(
  token: string,
  code: string,
  hostToken: string
): string | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "p") return null;
  const [, nonce, sig] = parts;
  if (!nonce || !sig) return null;
  const expected = participantSig(code, nonce, hostToken);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? nonce : null;
}
