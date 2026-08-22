import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { orders, syncState } from "@/db/schema";
import { HORIZON_URL, toStroops, USDC } from "@/lib/stellar";

/**
 * Catches payments the browser never reported.
 *
 * The normal path is the diner's client handing us the hash right after
 * paying. But if they close the tab, lose signal, or the battery dies between
 * signing and reporting, the money is on the ledger while the order sits
 * unpaid — and the kitchen never sees it. So the owner's account is polled
 * for incoming payments and matched by memo.
 *
 * There are no webhooks in the Pollar SDK (the docs list them as upcoming),
 * so polling is the only option. It runs against public Horizon, cursored, so
 * each pass only asks for what arrived since the last one.
 */

interface HorizonPayment {
  type: string;
  to?: string;
  amount?: string;
  asset_code?: string;
  asset_issuer?: string;
  paging_token: string;
  transaction_hash?: string;
  transaction?: { memo?: string; memo_type?: string; ledger?: number; successful?: boolean };
}

export interface ReconcileResult {
  scanned: number;
  settled: number;
  expired: number;
  orders: string[];
}

/**
 * How long an unpaid order stays open. Long enough to cover a slow signature,
 * a bad connection, or a diner who put the phone down mid-order; short enough
 * that abandoned orders don't pile up forever holding a memo reference.
 */
const PENDING_TTL_MS = 30 * 60 * 1000;

export async function reconcileRestaurant(
  restaurantId: string,
  ownerAddress: string
): Promise<ReconcileResult> {
  const [state] = await db
    .select()
    .from(syncState)
    .where(eq(syncState.restaurantId, restaurantId))
    .limit(1);

  const url = new URL(`${HORIZON_URL}/accounts/${ownerAddress}/payments`);
  url.searchParams.set("join", "transactions");
  url.searchParams.set("limit", "100");
  if (state?.lastCursor) {
    // Everything after what we already looked at.
    url.searchParams.set("order", "asc");
    url.searchParams.set("cursor", state.lastCursor);
  } else {
    // First pass: the most recent page, so an old account doesn't drag its
    // whole history through.
    url.searchParams.set("order", "desc");
  }

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return { scanned: 0, settled: 0, expired: 0, orders: [] };

  const body = (await res.json()) as { _embedded?: { records?: HorizonPayment[] } };
  const records = body._embedded?.records ?? [];

  const settled: string[] = [];
  let newestCursor = state?.lastCursor ?? null;

  for (const record of records) {
    if (!newestCursor || BigInt(record.paging_token) > BigInt(newestCursor)) {
      newestCursor = record.paging_token;
    }

    if (record.type !== "payment") continue;
    if (record.to !== ownerAddress) continue;
    if (record.asset_code !== USDC.code || record.asset_issuer !== USDC.issuer) continue;
    if (record.transaction?.successful === false) continue;
    if (record.transaction?.memo_type !== "id" || !record.transaction.memo) continue;
    if (!record.transaction_hash || !record.amount) continue;

    const memoId = Number(record.transaction.memo);
    if (!Number.isSafeInteger(memoId)) continue;

    const [order] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.memoId, memoId), eq(orders.restaurantId, restaurantId)))
      .limit(1);

    if (!order || order.status !== "pending") continue;
    // The memo says which order; the amount still has to agree.
    if (toStroops(record.amount) !== toStroops(order.total)) continue;
    if (record.to !== order.payToAddress) continue;

    try {
      const [updated] = await db
        .update(orders)
        .set({
          status: "paid",
          txHash: record.transaction_hash,
          ledger: record.transaction?.ledger,
          paidAt: new Date(),
        })
        .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
        .returning({ id: orders.id });
      if (updated) settled.push(updated.id);
    } catch {
      // UNIQUE on tx_hash: that payment already settled another order.
    }
  }

  if (newestCursor && newestCursor !== state?.lastCursor) {
    await db
      .insert(syncState)
      .values({ restaurantId, lastCursor: newestCursor, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: syncState.restaurantId,
        set: { lastCursor: newestCursor, updatedAt: new Date() },
      });
  }

  // Anything still unpaid past the window was abandoned: the diner closed the
  // menu without paying. Settlement runs first, so an order that really was
  // paid is already marked by the time this looks at it.
  const stale = await db
    .update(orders)
    .set({ status: "expired" })
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        eq(orders.status, "pending"),
        lt(orders.createdAt, new Date(Date.now() - PENDING_TTL_MS))
      )
    )
    .returning({ id: orders.id });

  return {
    scanned: records.length,
    settled: settled.length,
    expired: stale.length,
    orders: settled,
  };
}
