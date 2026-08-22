import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { menuCategory, menuItem } from "@/db/schema";
import { adminRoute } from "@/lib/admin-auth";
import { normalizeAmount } from "@/lib/money";

export const POST = adminRoute(async (restaurant, request) => {
  const body = (await request.json()) as {
    categoryId?: string;
    name?: string;
    price?: string;
    description?: string;
    photoUrl?: string;
  };

  const name = body.name?.trim();
  if (!name) return Response.json({ error: "El plato necesita un nombre." }, { status: 400 });

  const price = body.price ? normalizeAmount(body.price) : null;
  if (!price) {
    return Response.json(
      { error: "El precio tiene que ser un monto positivo, con dos decimales como máximo." },
      { status: 400 }
    );
  }

  // The category must belong to this restaurant — an id from the request
  // body is never proof of ownership.
  const [category] = await db
    .select({ id: menuCategory.id })
    .from(menuCategory)
    .where(
      and(
        eq(menuCategory.id, body.categoryId ?? ""),
        eq(menuCategory.restaurantId, restaurant.id)
      )
    )
    .limit(1);
  if (!category) {
    return Response.json({ error: "No encontramos esa categoría." }, { status: 404 });
  }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${menuItem.position}), -1) + 1` })
    .from(menuItem)
    .where(eq(menuItem.categoryId, category.id));

  const [created] = await db
    .insert(menuItem)
    .values({
      restaurantId: restaurant.id,
      categoryId: category.id,
      name,
      price,
      description: body.description?.trim() || null,
      photoUrl: body.photoUrl?.trim() || null,
      position: next,
    })
    .returning();

  return Response.json({ item: created }, { status: 201 });
});

export function ownedItem(restaurantId: string, id: string) {
  return and(eq(menuItem.id, id), eq(menuItem.restaurantId, restaurantId));
}
