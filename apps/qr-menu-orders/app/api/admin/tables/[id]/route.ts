import { db } from "@/db/client";
import { diningTable } from "@/db/schema";
import { adminRoute } from "@/lib/admin-auth";
import { ownedTable } from "../route";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = adminRoute<Ctx>(async (restaurant, _request, ctx) => {
  const { id } = await ctx.params;
  try {
    const [deleted] = await db
      .delete(diningTable)
      .where(ownedTable(restaurant.id, id))
      .returning({ id: diningTable.id });
    if (!deleted) return Response.json({ error: "No encontramos esa mesa." }, { status: 404 });
    return Response.json({ ok: true });
  } catch {
    // onDelete: "restrict" on orders.tableId — a table with history stays.
    return Response.json(
      { error: "Esta mesa ya tiene pedidos, así que no se puede eliminar." },
      { status: 409 }
    );
  }
});
