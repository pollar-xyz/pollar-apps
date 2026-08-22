import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { diningTable } from "@/db/schema";
import { adminRoute } from "@/lib/admin-auth";
import { tableCode } from "@/lib/ids";

export const POST = adminRoute(async (restaurant, request) => {
  const { label } = (await request.json()) as { label?: string };
  const trimmed = label?.trim();
  if (!trimmed) {
    return Response.json({ error: "La mesa necesita un nombre." }, { status: 400 });
  }

  // `code` is globally unique; retry on the (very unlikely) collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [created] = await db
        .insert(diningTable)
        .values({ restaurantId: restaurant.id, label: trimmed, code: tableCode() })
        .returning();
      return Response.json({ table: created }, { status: 201 });
    } catch (err) {
      if (attempt === 4) throw err;
    }
  }
  return Response.json({ error: "No pudimos generar un código." }, { status: 500 });
});

export const GET = adminRoute(async (restaurant) => {
  const rows = await db
    .select()
    .from(diningTable)
    .where(eq(diningTable.restaurantId, restaurant.id))
    .orderBy(diningTable.createdAt);
  return Response.json({ tables: rows });
});

export function ownedTable(restaurantId: string, id: string) {
  return and(eq(diningTable.id, id), eq(diningTable.restaurantId, restaurantId));
}
