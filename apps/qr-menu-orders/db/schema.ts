import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Money is always a decimal string ("3.50"), never a float. Floats can't hold
 * decimal cents exactly, and a payment is verified against the ledger by
 * comparing exact amounts — a cent of drift fails the check. See toStroops()
 * in lib/stellar.ts for the integer comparison.
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const restaurant = sqliteTable("restaurant", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /** Stellar address the diners' payments go to. */
  ownerAddress: text("owner_address").notNull(),
  /**
   * How the owner is named back to themselves. The address is the account;
   * this is the person. Stored at sign-up because the SDK keeps the profile
   * in memory only — after a reload the server has no way to look it up, and
   * showing someone a truncated public key where they expect to see their own
   * name is how a product stops feeling like a product.
   */
  ownerEmail: text("owner_email"),
  /**
   * SHA-256 of the admin token. A Pollar session can't be verified on the
   * server, so the address arriving in a request body proves nothing; this
   * token is what actually authorizes writes.
   */
  adminTokenHash: text("admin_token_hash").notNull(),
  createdAt: createdAt(),
});

export const menuCategory = sqliteTable(
  "menu_category",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("menu_category_restaurant_idx").on(t.restaurantId, t.position)]
);

export const menuItem = sqliteTable(
  "menu_item",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => menuCategory.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Decimal string, e.g. "3.50". */
    price: text("price").notNull(),
    photoUrl: text("photo_url"),
    /** The "se acabó" toggle: off means it doesn't show on today's menu. */
    available: integer("available", { mode: "boolean" }).notNull().default(true),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index("menu_item_restaurant_idx").on(t.restaurantId),
    index("menu_item_category_idx").on(t.categoryId, t.position),
  ]
);

/** "table" is a reserved SQL word, hence dining_table. */
export const diningTable = sqliteTable(
  "dining_table",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    /** What the QR encodes: /m/<code>. Globally unique, so one QR = one spot. */
    code: text("code").notNull().unique(),
    createdAt: createdAt(),
  },
  (t) => [index("dining_table_restaurant_idx").on(t.restaurantId)]
);

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "preparing",
  "delivered",
  "expired",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orders = sqliteTable(
  "orders",
  {
    id: id(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    tableId: text("table_id")
      .notNull()
      .references(() => diningTable.id, { onDelete: "restrict" }),
    /**
     * The order reference, travelling with the payment as a Stellar MEMO_ID.
     * Generated as Date.now() * 1000 + random(0..999): unique, and small
     * enough to stay an exact JS integer.
     */
    memoId: integer("memo_id").notNull().unique(),
    /**
     * What humans call it: "Pedido #7", counted per restaurant. The memo above
     * is a 16-digit millisecond stamp — right for matching a payment on the
     * ledger, unusable for calling an order out across a kitchen.
     */
    number: integer("number").notNull().default(0),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending"),
    /** Decimal string. */
    total: text("total").notNull(),
    /**
     * Snapshot of the restaurant's owner address when the order was placed.
     * If the owner later changes accounts, verifying an old order must still
     * check the account that was current at the time.
     */
    payToAddress: text("pay_to_address").notNull(),
    /**
     * Unique on purpose: the database itself makes it impossible for one
     * payment to settle two orders.
     */
    txHash: text("tx_hash").unique(),
    ledger: integer("ledger"),
    paidAt: integer("paid_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("orders_board_idx").on(t.restaurantId, t.status, t.createdAt),
    index("orders_paid_at_idx").on(t.restaurantId, t.paidAt),
    // One #7 per restaurant. Inserts retry on collision rather than lock, the
    // same way table codes do.
    uniqueIndex("orders_number_idx").on(t.restaurantId, t.number),
  ]
);

export const orderItem = sqliteTable(
  "order_item",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    /** Null once the menu item is deleted; the snapshot below is the record. */
    menuItemId: text("menu_item_id").references(() => menuItem.id, {
      onDelete: "set null",
    }),
    /** Snapshots: what was ordered at that price, immune to later menu edits. */
    name: text("name").notNull(),
    price: text("price").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [index("order_item_order_idx").on(t.orderId)]
);

/** Horizon paging cursor, so reconciliation only asks for what's new. */
export const syncState = sqliteTable(
  "sync_state",
  {
    restaurantId: text("restaurant_id")
      .primaryKey()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    lastCursor: text("last_cursor"),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("sync_state_restaurant_idx").on(t.restaurantId)]
);
