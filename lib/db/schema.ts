import {
  boolean,
  index,
  primaryKey,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Storefront database schema (PostgreSQL, Drizzle ORM).
 *
 * The ERP is the system of record for orders. The storefront keeps its own
 * copy of every order it takes so that:
 * - a placed order is never lost, even if the ERP is down at that moment;
 * - the ERP order number is stored next to the storefront order;
 * - failed submissions are retried (the `orders` table is the retry queue)
 *   and are visible to the team (`order_events` is the audit trail).
 *
 * Change the schema here, then run `npm run db:generate` to create a
 * migration in /drizzle and `npm run db:migrate` to apply it.
 */

/**
 * Where an order is in its journey into the ERP.
 * - pending:    saved, not sent yet
 * - submitting: being sent now (claimed by one worker)
 * - submitted:  the ERP accepted it; erp_order_number is set
 * - failed:     a temporary problem (ERP down, timeout); retried automatically
 *               until next_attempt_at is null (gave up)
 * - rejected:   the ERP refused it (e.g. prices changed, product gone); needs a person
 */
export const orderErpStatus = pgEnum("order_erp_status", [
  "pending",
  "submitting",
  "submitted",
  "failed",
  "rejected",
]);

/**
 * Fulfilment status from the ERP (contract enum). Customer-friendly labels
 * are in lib/orders/status.ts. Null until the ERP has the order.
 */
export const orderStatus = pgEnum("order_status", [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "dispatched",
  "completed",
  "cancelled",
]);

export type OrderCustomer = {
  name: string;
  phone: string;
  email?: string;
  /** Signed-in customer's ERP id, when known at checkout. */
  erpCustomerId?: string;
};

export type OrderAddress = { line1: string; line2?: string; city: string; notes?: string };

export type OrderFulfilment =
  | { type: "delivery"; address: OrderAddress; date?: string; slot?: string }
  | { type: "pickup"; outletId: string; date?: string; slot?: string };

export type OrderPayment = {
  method: "cash_on_delivery" | "card";
  status: "pending" | "paid" | "failed" | "refunded";
  /** Payment gateway reference, once payments exist (BUN-203). */
  reference?: string;
};

/** One order line as priced by the ERP at checkout (a snapshot; never re-read from the cart). */
export type OrderLine = {
  productId: string | null;
  productSlug: string;
  skuId?: string;
  name: string;
  variant?: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
  discount: number;
  lineTotal: number;
  schemeIds: string[];
};

export type OrderScheme = { id: string; name: string; description?: string; discount: number };
export type OrderFreeItem = {
  name: string;
  variant?: string;
  quantity: number;
  schemeName: string;
};

const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });

export const orders = pgTable(
  "orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** Storefront order number shown to the customer, e.g. "BT-261122-7K3QX". */
    number: text().notNull().unique(),
    /**
     * From the checkout page: the same key for every retry of the same
     * "Place order" click, so double clicks never create two orders. Also
     * sent to the ERP as the Idempotency-Key, so ERP retries never duplicate.
     */
    idempotencyKey: uuid("idempotency_key").notNull().unique(),

    customer: jsonb().$type<OrderCustomer>().notNull(),
    fulfilment: jsonb().$type<OrderFulfilment>().notNull(),
    lines: jsonb().$type<OrderLine[]>().notNull(),
    appliedSchemes: jsonb("applied_schemes").$type<OrderScheme[]>().notNull().default([]),
    freeItems: jsonb("free_items").$type<OrderFreeItem[]>().notNull().default([]),
    payment: jsonb().$type<OrderPayment>().notNull(),
    note: text(),

    currency: text().notNull(),
    subtotal: money("subtotal").notNull(),
    discountTotal: money("discount_total").notNull(),
    deliveryFee: money("delivery_fee").notNull(),
    total: money("total").notNull(),

    erpStatus: orderErpStatus("erp_status").notNull().default("pending"),
    erpOrderId: text("erp_order_id"),
    erpOrderNumber: text("erp_order_number"),
    erpCustomerId: text("erp_customer_id"),
    /** Latest fulfilment status from the ERP (webhook or polling, BUN-165). */
    status: orderStatus(),
    /** When the ERP says the status changed; older updates are ignored. */
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
    /** Last time the status was read from the ERP (polling fallback). */
    statusCheckedAt: timestamp("status_checked_at", { withTimezone: true }),
    /**
     * Secret for the guest tracking link (/orders/{number}?token=…), so only
     * the person who placed the order can see it without signing in.
     */
    accessToken: uuid("access_token").notNull().defaultRandom(),
    /** Submission attempts so far. */
    attempts: integer().notNull().default(0),
    lastError: text("last_error"),
    /** When the retry worker may try again. Null = no automatic retries (submitted, rejected, gave up). */
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow(),
    /** Set while one worker is submitting (stale locks are taken over after 5 minutes). */
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("orders_retry_idx").on(t.erpStatus, t.nextAttemptAt)],
);

/** Audit trail for each order: placed, submitted, failed (with the error), rejected, gave up… */
export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text().notNull(),
    message: text(),
    data: jsonb(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId, t.createdAt)],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

/* ------------------------------------------------------------------------- */
/* Customers (BUN-166)                                                        */
/* ------------------------------------------------------------------------- */

/**
 * Where a customer's profile is in its sync with the ERP.
 * - pending:  changed locally, not in the ERP yet
 * - syncing:  being sent now (claimed by one worker)
 * - synced:   the ERP has the latest version
 * - failed:   temporary problem; retried automatically
 * - conflict: the ERP says the phone/email belongs to a different customer,
 *             or the ERP customer is already linked to another storefront
 *             customer. A person has to sort it out (team is alerted).
 */
export const customerSyncStatus = pgEnum("customer_sync_status", [
  "pending",
  "syncing",
  "synced",
  "failed",
  "conflict",
]);

/**
 * A storefront customer: one row per person, linked to exactly one ERP
 * customer (`erp_customer_id` is unique). Phone numbers are stored in one
 * format (+94…) and emails in lower case, so the same person can't register
 * twice. Sign-in (BUN-186) attaches to this row.
 */
export const customers = pgTable(
  "customers",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    /** E.164, e.g. +94771234567 (lib/customers/phone.ts). */
    phone: text().notNull().unique(),
    /** Lower case. */
    email: text().unique(),
    erpCustomerId: text("erp_customer_id").unique(),

    /** Bumped on every local change to the profile or addresses. */
    version: integer().notNull().default(1),
    /** The version the ERP has. Behind `version` = something to send. */
    syncedVersion: integer("synced_version").notNull().default(0),
    syncStatus: customerSyncStatus("sync_status").notNull().default("pending"),
    syncAttempts: integer("sync_attempts").notNull().default(0),
    lastSyncError: text("last_sync_error"),
    nextSyncAt: timestamp("next_sync_at", { withTimezone: true }).defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customers_sync_idx").on(t.syncStatus, t.nextSyncAt)],
);

/** Saved delivery addresses (BUN-198). Sent to the ERP with the profile. */
export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid().primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    /** "Home", "Office" … */
    label: text(),
    line1: text().notNull(),
    line2: text(),
    city: text().notNull(),
    notes: text(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customer_addresses_customer_idx").on(t.customerId)],
);

export type Customer = typeof customers.$inferSelect;
export type CustomerAddress = typeof customerAddresses.$inferSelect;

/* ------------------------------------------------------------------------- */
/* Catalog freshness (BUN-167)                                                */
/* ------------------------------------------------------------------------- */

/**
 * A fingerprint (hash) of every catalog item as the ERP last had it. The
 * scheduled catalog check compares the ERP's current data against these to
 * find changes that a missed webhook didn't report, and refreshes exactly
 * those pages.
 */
export const catalogFingerprints = pgTable(
  "catalog_fingerprints",
  {
    /** "product" | "category" | "scheme" | "banner" */
    kind: text().notNull(),
    /** Product/category slug, or scheme/banner link_id. */
    key: text().notNull(),
    hash: text().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.key] })],
);

/** Small key/value store for background jobs (e.g. when the catalog was last checked). */
export const jobState = pgTable("job_state", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
