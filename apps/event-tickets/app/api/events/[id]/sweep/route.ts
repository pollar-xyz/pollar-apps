import { NextResponse } from "next/server";
import { requireAddress } from "@/lib/auth";
import { db, dbReady } from "@/lib/db";
import { expireSale } from "@/lib/sales";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Idempotent sweep: resolves `pending` sales whose window expired (buyer
 * closed the tab, never paid). Fires when the organizer opens their panel —
 * no external pinger. Only handles the "no payment came" side of the state
 * machine; the "payment came, needs verifying" side is Fase 2/5's other half,
 * still pending real testnet USDC.
 */
export async function POST(request: Request, ctx: Ctx) {
  const { id: eventId } = await ctx.params;
  await dbReady();

  const eventRow = await db.execute({
    sql: "SELECT organizer_pollar_id FROM events WHERE id = ?",
    args: [eventId],
  });
  if (eventRow.rows.length === 0) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const auth = requireAddress(request, String(eventRow.rows[0].organizer_pollar_id));
  if (!auth.ok) return auth.response;

  const stale = await db.execute({
    sql: "SELECT id FROM sales WHERE event_id = ? AND status = 'pending' AND expires_at_utc < datetime('now')",
    args: [eventId],
  });

  let expiredCount = 0;
  for (const row of stale.rows) {
    const result = await expireSale(String(row.id));
    if (result.expired) expiredCount++;
  }

  return NextResponse.json({ checked: stale.rows.length, expired: expiredCount });
}
