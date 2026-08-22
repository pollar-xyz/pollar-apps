import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { menuCategory } from "@/db/schema";
import { adminRoute } from "@/lib/admin-auth";

export const POST = adminRoute(async (restaurant, request) => {
  const { name } = (await request.json()) as { name?: string };
  const trimmed = name?.trim();
  if (!trimmed) {
    return Response.json({ error: "La categoría necesita un nombre." }, { status: 400 });
  }

  const [{ next }] = await db
    .select({ next: sql<number>`coalesce(max(${menuCategory.position}), -1) + 1` })
    .from(menuCategory)
    .where(eq(menuCategory.restaurantId, restaurant.id));

  const [created] = await db
    .insert(menuCategory)
    .values({ restaurantId: restaurant.id, name: trimmed, position: next })
    .returning();

  return Response.json({ category: created }, { status: 201 });
});

export const GET = adminRoute(async (restaurant) => {
  const rows = await db
    .select()
    .from(menuCategory)
    .where(eq(menuCategory.restaurantId, restaurant.id))
    .orderBy(menuCategory.position);
  return Response.json({ categories: rows });
});

/** Shared by the [id] routes: never trust an id without scoping it. */
export function ownedCategory(restaurantId: string, id: string) {
  return and(eq(menuCategory.id, id), eq(menuCategory.restaurantId, restaurantId));
}
