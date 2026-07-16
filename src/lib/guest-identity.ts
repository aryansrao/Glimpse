import { nanoid } from "nanoid";

const ADJECTIVES = [
  "Quiet", "Amber", "Velvet", "Hollow", "Silver", "Faint", "Drifting",
  "Curious", "Distant", "Gentle", "Hazy", "Wandering", "Muted", "Coastal",
  "Nocturnal", "Paper", "Static", "Violet", "Marble", "Feral", "Nomad",
  "Pale", "Restless", "Solar", "Glass", "Ashen", "Lucid", "Ember",
];

const NOUNS = [
  "Fox", "Wren", "Lynx", "Moth", "Otter", "Heron", "Comet", "Ridge",
  "Willow", "Sparrow", "Petrel", "Ibis", "Marten", "Kestrel", "Tundra",
  "Harbor", "Lantern", "Cipher", "Orbit", "Ember", "Crane", "Finch",
  "Prairie", "Delta", "Compass", "Static", "Echo",
];

/** Deterministic guest name from a seed, so a returning guest cookie keeps its name. */
export function guestNameFromSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const a = ADJECTIVES[Math.abs(hash) % ADJECTIVES.length];
  const n = NOUNS[Math.abs(hash >> 3) % NOUNS.length];
  const num = Math.abs(hash >> 7) % 100;
  return `${a} ${n} #${num}`;
}

export function newGuestId() {
  return `guest_${nanoid(16)}`;
}

export function newGuestName() {
  return guestNameFromSeed(nanoid(10));
}

/** A stable hue derived from the guest/user id, used to color their avatar ring/initials. */
export function hueFromId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}
