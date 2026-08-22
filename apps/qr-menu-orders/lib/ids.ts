import { randomBytes, randomInt } from "node:crypto";

/** Unambiguous alphabet: no 0/O, no 1/I/L — table codes get read aloud. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Short code for a table's QR: /m/<code>. */
export function tableCode(length = 6): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/**
 * The order reference that travels as a Stellar MEMO_ID.
 *
 * Milliseconds plus three random digits: unique across restaurants, and at
 * ~1.8e15 it stays well under JS's exact-integer limit (9.007e15), so the
 * number that goes into the memo is the number that comes back from the
 * ledger and from SQLite — no precision loss anywhere in the round trip.
 */
export function newMemoId(): number {
  return Date.now() * 1000 + randomInt(1000);
}

/** URL-safe slug from a restaurant name. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
