import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, dbReady } from "@/db/client";
import {
  diningTable,
  menuCategory,
  menuItem,
  orderItem,
  orders,
  restaurant,
  type OrderStatus,
} from "@/db/schema";
import { sum } from "@/lib/money";
import { startOfToday } from "@/lib/time";

export type MenuItemRow = typeof menuItem.$inferSelect;
export type CategoryWithItems = typeof menuCategory.$inferSelect & {
  items: MenuItemRow[];
};

export async function getMenu(restaurantId: string): Promise<CategoryWithItems[]> {
  await dbReady();
  const categories = await db
    .select()
    .from(menuCategory)
    .where(eq(menuCategory.restaurantId, restaurantId))
    .orderBy(menuCategory.position);

  if (categories.length === 0) return [];

  const items = await db
    .select()
    .from(menuItem)
    .where(eq(menuItem.restaurantId, restaurantId))
    .orderBy(menuItem.position);

  return categories.map((category) => ({
    ...category,
    items: items.filter((item) => item.categoryId === category.id),
  }));
}

export async function getTables(restaurantId: string) {
  await dbReady();
  return db
    .select()
    .from(diningTable)
    .where(eq(diningTable.restaurantId, restaurantId))
    .orderBy(diningTable.createdAt);
}

export async function getTableByCode(code: string) {
  await dbReady();
  const [row] = await db
    .select({
      table: diningTable,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        ownerAddress: restaurant.ownerAddress,
      },
    })
    .from(diningTable)
    .innerJoin(restaurant, eq(diningTable.restaurantId, restaurant.id))
    .where(eq(diningTable.code, code))
    .limit(1);
  return row ?? null;
}

export type OrderRow = typeof orders.$inferSelect;
export type OrderLine = typeof orderItem.$inferSelect;
export type OrderWithLines = OrderRow & {
  tableLabel: string;
  lines: OrderLine[];
};

async function withLines(rows: (OrderRow & { tableLabel: string })[]) {
  if (rows.length === 0) return [];
  const lines = await db
    .select()
    .from(orderItem)
    .where(
      inArray(
        orderItem.orderId,
        rows.map((r) => r.id)
      )
    );
  return rows.map((row) => ({
    ...row,
    lines: lines.filter((line) => line.orderId === row.id),
  }));
}

/**
 * The board shows what the kitchen still owes: paid and preparing, plus what
 * was delivered today so the cook can see the run of service.
 */
export async function getBoardOrders(restaurantId: string): Promise<OrderWithLines[]> {
  await dbReady();
  const statuses: OrderStatus[] = ["paid", "preparing", "delivered"];
  const rows = await db
    .select({
      ...orderColumns(),
      tableLabel: diningTable.label,
    })
    .from(orders)
    .innerJoin(diningTable, eq(orders.tableId, diningTable.id))
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        inArray(orders.status, statuses),
        gte(orders.createdAt, startOfToday())
      )
    )
    .orderBy(desc(orders.paidAt));
  return withLines(rows);
}

export async function getHistory(
  restaurantId: string,
  limit = 100
): Promise<OrderWithLines[]> {
  await dbReady();
  const rows = await db
    .select({ ...orderColumns(), tableLabel: diningTable.label })
    .from(orders)
    .innerJoin(diningTable, eq(orders.tableId, diningTable.id))
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        inArray(orders.status, ["paid", "preparing", "delivered"])
      )
    )
    .orderBy(desc(orders.paidAt))
    .limit(limit);
  return withLines(rows);
}

/** Orders and money taken today, in the restaurant's own timezone. */
export async function getTodaySummary(restaurantId: string) {
  await dbReady();
  const rows = await db
    .select({ total: orders.total })
    .from(orders)
    .where(
      and(
        eq(orders.restaurantId, restaurantId),
        inArray(orders.status, ["paid", "preparing", "delivered"]),
        gte(orders.paidAt, startOfToday())
      )
    );
  return {
    count: rows.length,
    // Summed as integer cents, never floats.
    total: rows.length ? sum(rows.map((r) => r.total)) : "0.00",
  };
}

export async function countPendingOrders(restaurantId: string): Promise<number> {
  await dbReady();
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(orders)
    .where(and(eq(orders.restaurantId, restaurantId), eq(orders.status, "pending")));
  return Number(row?.n ?? 0);
}

/** Explicit column list: `select()` with a join would nest the row. */
function orderColumns() {
  return {
    id: orders.id,
    restaurantId: orders.restaurantId,
    tableId: orders.tableId,
    memoId: orders.memoId,
    number: orders.number,
    status: orders.status,
    total: orders.total,
    payToAddress: orders.payToAddress,
    txHash: orders.txHash,
    ledger: orders.ledger,
    paidAt: orders.paidAt,
    createdAt: orders.createdAt,
  };
}
