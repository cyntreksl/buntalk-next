import "server-only";
import { and, asc, eq, isNotNull, isNull, lt, notInArray, or } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { orderEvents, orders, type Order } from "@/lib/db/schema";
import { getOrder } from "@/lib/erp";
import { ERP_ORDER_STATUSES, FINAL_STATUSES, type ErpOrderStatus } from "./status";

/**
 * Keeps each storefront order's status in step with the ERP (BUN-165).
 *
 * Two ways in, both through applyStatus():
 * - Webhook (instant): the ERP calls POST /api/webhooks/erp/order-status
 *   when an order's status changes.
 * - Polling (fallback, ≤ 5 minutes): the retry cron (POST /api/orders/retry)
 *   also reads the status of open orders that haven't been checked for 5
 *   minutes, and an order page re-checks when its status is over a minute old.
 *
 * Updates are applied in order of when they happened in the ERP: an older
 * or repeated update (late webhook, retry) never overwrites a newer status.
 */

export const POLL_INTERVAL_MS = 5 * 60_000;
export const VIEW_REFRESH_MS = 60_000;

export type StatusUpdate = {
  status: ErpOrderStatus;
  /** When it changed in the ERP. Missing → "now". */
  changedAt?: Date;
  source: "webhook" | "poll" | "submit";
};

export const isErpOrderStatus = (value: unknown): value is ErpOrderStatus =>
  typeof value === "string" && (ERP_ORDER_STATUSES as readonly string[]).includes(value);

/** Applies a status update. Returns true if the order's status changed. */
export async function applyStatus(
  db: Db,
  order: Pick<Order, "id" | "number" | "status" | "statusChangedAt">,
  update: StatusUpdate,
  now: Date = new Date(),
): Promise<boolean> {
  const changedAt = update.changedAt ?? now;
  const stale = order.statusChangedAt !== null && changedAt < order.statusChangedAt;
  const same = order.status === update.status;

  if (stale || same) {
    await db.update(orders).set({ statusCheckedAt: now }).where(eq(orders.id, order.id));
    return false;
  }

  // Only move forward from what is stored (guards against a concurrent newer update).
  const [updated] = await db
    .update(orders)
    .set({
      status: update.status,
      statusChangedAt: changedAt,
      statusCheckedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(orders.id, order.id),
        or(isNull(orders.statusChangedAt), lt(orders.statusChangedAt, changedAt)),
      ),
    )
    .returning({ id: orders.id });
  if (!updated) return false;

  await db.insert(orderEvents).values({
    orderId: order.id,
    type: "status",
    message: `${order.status ?? "none"} → ${update.status} (${update.source})`,
    data: {
      from: order.status,
      to: update.status,
      changedAt: changedAt.toISOString(),
      source: update.source,
    },
  });
  console.info(
    `[orders] ${order.number} status ${order.status ?? "none"} → ${update.status} (${update.source})`,
  );
  return true;
}

/**
 * Finds the storefront order an ERP update is about. Our own order number is
 * matched first; when both references are given they must agree (an ERP id
 * that belongs to a different storefront order is ignored, never applied).
 */
export async function findOrderForErp(
  db: Db,
  ref: { erpOrderId?: string; storefrontOrderNumber?: string },
): Promise<Order | undefined> {
  if (ref.storefrontOrderNumber) {
    const [byNumber] = await db
      .select()
      .from(orders)
      .where(eq(orders.number, ref.storefrontOrderNumber))
      .limit(1);
    if (!byNumber) return undefined;
    if (ref.erpOrderId && byNumber.erpOrderId && byNumber.erpOrderId !== ref.erpOrderId) {
      console.warn(
        `[orders] ERP update for ${ref.storefrontOrderNumber} has ERP id ${ref.erpOrderId}, expected ${byNumber.erpOrderId}; ignored`,
      );
      return undefined;
    }
    return byNumber;
  }
  if (ref.erpOrderId) {
    const [byId] = await db
      .select()
      .from(orders)
      .where(eq(orders.erpOrderId, ref.erpOrderId))
      .limit(1);
    return byId;
  }
  return undefined;
}

/** Reads one order's status from the ERP and applies it. */
async function pollOne(db: Db, order: Order, now: Date): Promise<boolean> {
  if (!order.erpOrderId) return false;
  const erpOrder = await getOrder(order.erpOrderId);
  if (!erpOrder) {
    await db.update(orders).set({ statusCheckedAt: now }).where(eq(orders.id, order.id));
    return false;
  }
  return applyStatus(
    db,
    order,
    {
      status: erpOrder.status,
      changedAt: erpOrder.statusChangedAt ? new Date(erpOrder.statusChangedAt) : undefined,
      source: "poll",
    },
    now,
  );
}

/**
 * Polling fallback: open orders in the ERP whose status hasn't been checked
 * for POLL_INTERVAL_MS. Called from the retry cron. One failing ERP call
 * doesn't stop the others.
 */
export async function pollOrderStatuses(
  db: Db,
  options: { limit?: number; now?: Date } = {},
): Promise<{ checked: number; changed: number; errors: number }> {
  const now = options.now ?? new Date();
  const due = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.erpStatus, "submitted"),
        isNotNull(orders.erpOrderId),
        or(isNull(orders.status), notInArray(orders.status, [...FINAL_STATUSES])),
        or(
          isNull(orders.statusCheckedAt),
          lt(orders.statusCheckedAt, new Date(now.getTime() - POLL_INTERVAL_MS)),
        ),
      ),
    )
    .orderBy(asc(orders.statusCheckedAt))
    .limit(options.limit ?? 25);

  const result = { checked: 0, changed: 0, errors: 0 };
  for (const order of due) {
    try {
      result.checked++;
      if (await pollOne(db, order, now)) result.changed++;
    } catch (error) {
      result.errors++;
      console.warn(`[orders] status poll failed for ${order.number}`, error);
    }
  }
  return result;
}

/**
 * Used by the order page: if the status is more than a minute old, ask the
 * ERP now. Never throws (the page shows the last known status instead).
 */
export async function refreshStatusIfStale(
  db: Db,
  order: Order,
  now: Date = new Date(),
): Promise<Order> {
  const open = order.status === null || !FINAL_STATUSES.has(order.status);
  const checked = order.statusCheckedAt?.getTime() ?? 0;
  if (!open || !order.erpOrderId || now.getTime() - checked < VIEW_REFRESH_MS) return order;
  try {
    await pollOne(db, order, now);
    const [fresh] = await db.select().from(orders).where(eq(orders.id, order.id)).limit(1);
    return fresh ?? order;
  } catch (error) {
    console.warn(`[orders] status refresh failed for ${order.number}`, error);
    return order;
  }
}
