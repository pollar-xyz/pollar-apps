import { eq } from "drizzle-orm";
import { db, dbReady } from "@/db/client";
import { orders } from "@/db/schema";

/** Status of one order, for the diner's confirmation screen to poll. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  await dbReady();

  const [row] = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      total: orders.total,
      memoId: orders.memoId,
      txHash: orders.txHash,
      paidAt: orders.paidAt,
    })
    .from(orders)
    .where(eq(orders.id, id))
    .limit(1);

  if (!row) return Response.json({ error: "No encontramos ese pedido." }, { status: 404 });
  return Response.json({ order: row });
}
