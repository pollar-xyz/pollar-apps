import { db } from "@/db/client";
import { menuItem } from "@/db/schema";
import { adminRoute } from "@/lib/admin-auth";
import { normalizeAmount } from "@/lib/money";
import { ownedItem } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = adminRoute<Ctx>(async (restaurant, request, ctx) => {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    name?: string;
    price?: string;
    description?: string | null;
    photoUrl?: string | null;
    available?: boolean;
    position?: number;
  };

  const patch: Partial<typeof menuItem.$inferInsert> = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return Response.json({ error: "El plato necesita un nombre." }, { status: 400 });
    patch.name = name;
  }
  if (body.price !== undefined) {
    const price = normalizeAmount(body.price);
    if (!price) {
      return Response.json(
        { error: "El precio tiene que ser un monto positivo, con dos decimales como máximo." },
        { status: 400 }
      );
    }
    patch.price = price;
  }
  if (body.description !== undefined) patch.description = body.description?.trim() || null;
  if (body.photoUrl !== undefined) patch.photoUrl = body.photoUrl?.trim() || null;
  // The "se acabó" toggle.
  if (body.available !== undefined) patch.available = body.available;
  if (body.position !== undefined) patch.position = body.position;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "No hay nada que cambiar." }, { status: 400 });
  }

  const [updated] = await db
    .update(menuItem)
    .set(patch)
    .where(ownedItem(restaurant.id, id))
    .returning();

  if (!updated) return Response.json({ error: "No encontramos ese plato." }, { status: 404 });
  return Response.json({ item: updated });
});

export const DELETE = adminRoute<Ctx>(async (restaurant, _request, ctx) => {
  const { id } = await ctx.params;
  const [deleted] = await db
    .delete(menuItem)
    .where(ownedItem(restaurant.id, id))
    .returning({ id: menuItem.id });
  if (!deleted) return Response.json({ error: "No encontramos ese plato." }, { status: 404 });
  return Response.json({ ok: true });
});
