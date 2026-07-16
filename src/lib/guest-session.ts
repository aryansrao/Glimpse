import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { newGuestId, guestNameFromSeed } from "./guest-identity";

const COOKIE_NAME = "glimpse_guest";
const ONE_YEAR = 60 * 60 * 24 * 365;

function secret() {
  return process.env.AUTH_SECRET ?? "glimpse-dev-secret-change-me";
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("hex").slice(0, 16);
}

export type GuestIdentity = { id: string; name: string };

function encode(identity: GuestIdentity) {
  const payload = `${identity.id}.${identity.name}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

function decode(raw: string): GuestIdentity | null {
  try {
    const [b64, sig] = raw.split(".");
    const payload = Buffer.from(b64, "base64url").toString("utf8");
    if (sign(payload) !== sig) return null;
    const [id, name] = payload.split(".");
    if (!id || !name) return null;
    return { id, name };
  } catch {
    return null;
  }
}

/** Reads the guest identity cookie if present and valid — does not create one. */
export async function readGuestIdentity(): Promise<GuestIdentity | null> {
  const store = await cookies();
  const raw = store.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  return decode(raw);
}

/**
 * Gets the current guest identity, minting a new stable, non-editable
 * nickname and id on first visit. Safe to call from route handlers and
 * server actions (anywhere `cookies()` is writable).
 */
export async function getOrCreateGuestIdentity(): Promise<GuestIdentity> {
  const existing = await readGuestIdentity();
  if (existing) return existing;

  const id = newGuestId();
  const identity: GuestIdentity = { id, name: guestNameFromSeed(id) };

  const store = await cookies();
  store.set(COOKIE_NAME, encode(identity), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });

  return identity;
}
