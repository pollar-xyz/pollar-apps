import { randomBytes } from "node:crypto";
import type { Transaction } from "@libsql/client";
import { db, withTransaction } from "./db.ts";
import { newId } from "./ids.ts";

/** Unambiguous alphabet: no 0/O, no 1/I/L. 32 symbols = 5 bits/char, no modulo bias (256 / 32). */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** The QR payload. CSPRNG, 26 chars * 5 bits = 130 bits of entropy. Never derived from sale_id/timestamp. */
export function generateTicketCode(): string {
  return randomCode(26);
}

/** Typed by hand at the door. Only the authenticated door endpoint accepts it, so it doesn't need public-facing entropy. */
export function generateDoorCode(): string {
  return randomCode(8);
}

export type Ticket = {
  id: string;
  saleId: string;
  eventId: string;
  code: string;
  doorCode: string;
  usedAt: string | null;
  usedBy: string | null;
  createdAt: string;
};

/**
 * Emits the ticket for a paid sale. Idempotent via `tickets.sale_id` UNIQUE:
 * a second call for the same sale (e.g. the sweep re-running) is a no-op
 * that returns the existing ticket instead of throwing or duplicating.
 *
 * Runs inside the caller's transaction when one is given (the "mark paid +
 * issue ticket" atomicity from the design), or opens its own otherwise.
 */
export async function issueTicket(
  saleId: string,
  eventId: string,
  tx?: Transaction
): Promise<Ticket> {
  const runner = tx ?? db;

  const existing = await runner.execute({
    sql: "SELECT id, sale_id, event_id, code, door_code, used_at, used_by, created_at FROM tickets WHERE sale_id = ?",
    args: [saleId],
  });
  if (existing.rows.length > 0) {
    return rowToTicket(existing.rows[0]);
  }

  // door_code must be unique per event; retry on the rare collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newId();
    const code = generateTicketCode();
    const doorCode = generateDoorCode();
    try {
      const inserted = await runner.execute({
        sql: `INSERT INTO tickets (id, sale_id, event_id, code, door_code)
              VALUES (?, ?, ?, ?, ?)
              RETURNING id, sale_id, event_id, code, door_code, used_at, used_by, created_at`,
        args: [id, saleId, eventId, code, doorCode],
      });
      return rowToTicket(inserted.rows[0]);
    } catch (err) {
      if (err instanceof Error && /UNIQUE/i.test(err.message) && /door_code/i.test(err.message)) {
        continue;
      }
      // sale_id UNIQUE lost a race with a concurrent issuer: fetch what won.
      if (err instanceof Error && /UNIQUE/i.test(err.message) && /sale_id/i.test(err.message)) {
        const winner = await runner.execute({
          sql: "SELECT id, sale_id, event_id, code, door_code, used_at, used_by, created_at FROM tickets WHERE sale_id = ?",
          args: [saleId],
        });
        if (winner.rows.length > 0) return rowToTicket(winner.rows[0]);
      }
      throw err;
    }
  }
  throw new Error(`could not allocate a unique door_code for event ${eventId}`);
}

export type DoorResult =
  | { result: "VALID"; ticket: Ticket }
  | { result: "USED"; usedAt: string }
  | { result: "UNKNOWN" };

/**
 * Atomic door validation: `event_id` is part of the same UPDATE, so a valid
 * ticket from a different event neither validates nor gets consumed — it
 * just reads back as UNKNOWN, indistinguishable from a code that doesn't
 * exist at all (never leaks "this code is real, just for another event").
 */
export async function validateAtDoor(
  eventId: string,
  code: string,
  usedBy: string
): Promise<DoorResult> {
  return withTransaction(async (tx) => {
    const updated = await tx.execute({
      sql: `UPDATE tickets SET used_at = datetime('now'), used_by = ?
            WHERE code = ? AND event_id = ? AND used_at IS NULL
            RETURNING id, sale_id, event_id, code, door_code, used_at, used_by, created_at`,
      args: [usedBy, code, eventId],
    });
    if (updated.rows.length > 0) {
      return { result: "VALID", ticket: rowToTicket(updated.rows[0]) };
    }

    const existing = await tx.execute({
      sql: "SELECT used_at FROM tickets WHERE code = ? AND event_id = ?",
      args: [code, eventId],
    });
    if (existing.rows.length > 0) {
      return { result: "USED", usedAt: String(existing.rows[0].used_at) };
    }
    return { result: "UNKNOWN" };
  });
}

function rowToTicket(row: Record<string, unknown>): Ticket {
  return {
    id: String(row.id),
    saleId: String(row.sale_id),
    eventId: String(row.event_id),
    code: String(row.code),
    doorCode: String(row.door_code),
    usedAt: row.used_at == null ? null : String(row.used_at),
    usedBy: row.used_by == null ? null : String(row.used_by),
    createdAt: String(row.created_at),
  };
}
