import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orders, type OrderStatus } from "@/db/schema";
import { adminRoute } from "@/lib/admin-auth";

/**
 * Orders only move forward, and only along the service path. An order can't
 * jump back to paid once delivered, and nothing here can mark an unpaid
 * order as paid — that only ever happens by verifying a real payment.
 */
const NEXT: Partial<Record<OrderStatus, OrderStatus[]>> = {
  paid: ["preparing"],
  preparing: ["delivered"],
};

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = adminRoute<Ctx>(async (restaurant, request, ctx) => {
  const { id } = await ctx.params;
  const { status } = (await request.json()) as { status?: OrderStatus };

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.restaurantId, restaurant.id)))
    .limit(1);

  if (!order) return Response.json({ error: "No encontramos ese pedido." }, { status: 404 });

  const allowed = NEXT[order.status] ?? [];
  if (!status || !allowed.includes(status)) {
    return Response.json(
      {
        error: `Un pedido en "${order.status}" solo puede pasar a: ${
          allowed.join(", ") || "ningún otro estado"
        }.`,
      },
      { status: 409 }
    );
  }

  const [updated] = await db
    .update(orders)
    .set({ status })
    .where(and(eq(orders.id, id), eq(orders.status, order.status)))
    .returning();

  return Response.json({ order: updated });
});
