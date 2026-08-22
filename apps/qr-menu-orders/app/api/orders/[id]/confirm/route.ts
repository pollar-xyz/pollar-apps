import { and, eq } from "drizzle-orm";
import { db, dbReady } from "@/db/client";
import { orders } from "@/db/schema";
import { verifyPayment } from "@/lib/horizon";

/**
 * "I paid, here's the hash." The claim is worth nothing on its own, so the
 * server asks the Stellar ledger whether that hash really is a payment of
 * this order's total, in USDC, to this order's account, carrying this
 * order's reference. Only then does the order become paid.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  await dbReady();

  let body: { hash?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Pedido mal formado." }, { status: 400 });
  }

  const hash = body.hash?.trim();
  if (!hash) return Response.json({ error: "Falta el hash de la transacción." }, { status: 400 });

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return Response.json({ error: "No encontramos ese pedido." }, { status: 404 });

  // Already settled: replying with the stored result keeps a retry (or a
  // double tap) harmless.
  if (order.txHash) {
    return Response.json({ order, alreadyPaid: true });
  }

  const result = await verifyPayment({
    hash,
    destination: order.payToAddress,
    amount: order.total,
    memoId: String(order.memoId),
  });

  if (!result.ok) {
    return Response.json(
      { error: result.error ?? "No pudimos verificar el pago.", checks: result.checks },
      { status: 402 }
    );
  }

  const ledger =
    typeof result.raw?.transaction === "object" && result.raw.transaction !== null
      ? (result.raw.transaction as { ledger?: number }).ledger
      : undefined;

  try {
    // Guarded on status: two concurrent confirms can't both settle it.
    const [updated] = await db
      .update(orders)
      .set({ status: "paid", txHash: hash, ledger, paidAt: new Date() })
      .where(and(eq(orders.id, id), eq(orders.status, "pending")))
      .returning();

    if (!updated) {
      const [current] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
      return Response.json({ order: current, alreadyPaid: true });
    }
    return Response.json({ order: updated });
  } catch {
    // The UNIQUE index on tx_hash: this payment already settled another order.
    return Response.json(
      { error: "Esa transacción ya pagó otro pedido." },
      { status: 409 }
    );
  }
}
