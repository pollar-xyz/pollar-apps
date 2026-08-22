import { db } from "@/db/client";
import { menuCategory } from "@/db/schema";
import { adminRoute } from "@/lib/admin-auth";
import { ownedCategory } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = adminRoute<Ctx>(async (restaurant, request, ctx) => {
  const { id } = await ctx.params;
  const body = (await request.json()) as { name?: string; position?: number };

  const patch: Partial<typeof menuCategory.$inferInsert> = {};
  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return Response.json({ error: "La categoría necesita un nombre." }, { status: 400 });
    patch.name = name;
  }
  if (body.position !== undefined) patch.position = body.position;
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "No hay nada que cambiar." }, { status: 400 });
  }

  // Scoped by restaurant as well as id: an id alone must never be enough.
  const [updated] = await db
    .update(menuCategory)
    .set(patch)
    .where(ownedCategory(restaurant.id, id))
    .returning();

  if (!updated) return Response.json({ error: "No encontramos esa categoría." }, { status: 404 });
  return Response.json({ category: updated });
});

export const DELETE = adminRoute<Ctx>(async (restaurant, _request, ctx) => {
  const { id } = await ctx.params;
  const [deleted] = await db
    .delete(menuCategory)
    .where(ownedCategory(restaurant.id, id))
    .returning({ id: menuCategory.id });
  if (!deleted) return Response.json({ error: "No encontramos esa categoría." }, { status: 404 });
  return Response.json({ ok: true });
});
