import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, lt, lte, or, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { orderEvents, orders, type Order } from "@/lib/db/schema";
import {
  ErpConfigError,
  ErpConflictError,
  ErpError,
  ErpValidationError,
  createOrder,
  matchOrCreateCustomer,
} from "@/lib/erp";
import { sendOrderAlert } from "./alerts";

/**
 * Sends saved orders to the ERP, the system of record (BUN-164).
 *
 * - One worker at a time per order: an order is "claimed" with a single
 *   atomic UPDATE, so two retry runs can never send the same order twice at
 *   once. A claim older than 5 minutes (crashed worker) is taken over.
 * - Idempotent: the ERP customer and order calls send the order's
 *   idempotency key, so a retry after a timeout returns the existing ERP
 *   order instead of creating a duplicate.
 * - Temporary problems (ERP down, timeouts, 429/5xx, credentials) → "failed",
 *   retried with growing waits: 1, 2, 4 … minutes, at most 1 hour apart, up to
 *   MAX_ATTEMPTS. Then it gives up and alerts the team.
 * - The ERP refusing the order (409 conflict, 422 validation, e.g. prices
 *   changed) → "rejected": not retried, the team is alerted at once.
 */

export const MAX_ATTEMPTS = 8;
const STALE_LOCK_MS = 5 * 60_000;
/** Alert on this many failed attempts in a row (not on every blip). */
const ALERT_AFTER_ATTEMPTS = 3;

export function retryDelayMs(attempts: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 60 * 60_000);
}

const describe = (error: unknown) =>
  error instanceof ErpError
    ? `${error.name} (${error.status}) ${error.message}${error.requestId ? ` [request ${error.requestId}]` : ""}`
    : error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);

async function event(db: Db, orderId: string, type: string, message: string, data?: unknown) {
  await db.insert(orderEvents).values({ orderId, type, message, data: data ?? null });
}

/** Claims the order for this worker, or returns null if it's done or someone else has it. */
async function claim(db: Db, orderId: string, now: Date): Promise<Order | null> {
  const [claimed] = await db
    .update(orders)
    .set({
      erpStatus: "submitting",
      lockedAt: now,
      attempts: sql`${orders.attempts} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(orders.id, orderId),
        or(
          inArray(orders.erpStatus, ["pending", "failed"]),
          and(
            eq(orders.erpStatus, "submitting"),
            lt(orders.lockedAt, new Date(now.getTime() - STALE_LOCK_MS)),
          ),
        ),
      ),
    )
    .returning();
  return claimed ?? null;
}

export type SubmitResult = "submitted" | "failed" | "rejected" | "skipped";

export async function submitOrder(
  db: Db,
  orderId: string,
  now: Date = new Date(),
): Promise<SubmitResult> {
  const order = await claim(db, orderId, now);
  if (!order) return "skipped";

  try {
    // 1. The ERP customer: the signed-in customer's id, or match/create by phone.
    let customerId = order.erpCustomerId ?? order.customer.erpCustomerId;
    if (!customerId) {
      const customer = await matchOrCreateCustomer(
        order.customer,
        `${order.idempotencyKey}:customer`,
      );
      customerId = customer.id;
      await db.update(orders).set({ erpCustomerId: customerId }).where(eq(orders.id, order.id));
    }

    // 2. The order itself. The ERP re-prices it and refuses it (409) if totals differ.
    const erpOrder = await createOrder(
      {
        storefrontOrderId: order.id,
        storefrontOrderNumber: order.number,
        customerId,
        fulfilment: order.fulfilment,
        lines: order.lines.map((l) => ({
          productId: l.productId ?? "",
          skuId: l.skuId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
          lineTotal: l.lineTotal,
          schemeIds: l.schemeIds,
        })),
        appliedSchemeIds: order.appliedSchemes.map((s) => s.id),
        currency: order.currency,
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        payment: order.payment,
        note: order.note ?? undefined,
      },
      order.idempotencyKey,
    );

    await db
      .update(orders)
      .set({
        erpStatus: "submitted",
        erpOrderId: erpOrder.id,
        erpOrderNumber: erpOrder.number,
        erpCustomerId: customerId,
        // First status from the ERP (BUN-165); later changes come by webhook or polling.
        status: erpOrder.status,
        statusChangedAt: erpOrder.statusChangedAt ? new Date(erpOrder.statusChangedAt) : now,
        statusCheckedAt: now,
        submittedAt: now,
        lockedAt: null,
        nextAttemptAt: null,
        lastError: null,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));
    await event(db, order.id, "submitted", `ERP order ${erpOrder.number}`, {
      erpOrderId: erpOrder.id,
      attempt: order.attempts,
    });
    console.info(`[orders] ${order.number} → ERP ${erpOrder.number} (attempt ${order.attempts})`);
    return "submitted";
  } catch (error) {
    const detail = describe(error);

    // The ERP refused the order: retrying won't help, a person has to look at it.
    if (error instanceof ErpConflictError || error instanceof ErpValidationError) {
      await db
        .update(orders)
        .set({
          erpStatus: "rejected",
          lockedAt: null,
          nextAttemptAt: null,
          lastError: detail,
          updatedAt: now,
        })
        .where(eq(orders.id, order.id));
      await event(db, order.id, "rejected", error.userMessage, {
        error: detail,
        fieldErrors: error instanceof ErpValidationError ? error.fieldErrors : undefined,
      });
      await sendOrderAlert({
        kind: "rejected",
        orderNumber: order.number,
        message: `The ERP rejected this order: ${error.userMessage}`,
        detail,
      });
      return "rejected";
    }

    // Temporary (ERP down, timeout, rate limit, bad response, credentials): retry later.
    const gaveUp = order.attempts >= MAX_ATTEMPTS;
    const next = gaveUp ? null : new Date(now.getTime() + retryDelayMs(order.attempts));
    await db
      .update(orders)
      .set({
        erpStatus: "failed",
        lockedAt: null,
        nextAttemptAt: next,
        lastError: detail,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));
    await event(db, order.id, "submit_failed", detail, {
      attempt: order.attempts,
      nextAttemptAt: next?.toISOString() ?? null,
    });
    console.warn(`[orders] ${order.number} submit failed (attempt ${order.attempts}): ${detail}`);

    if (gaveUp) {
      await sendOrderAlert({
        kind: "gave_up",
        orderNumber: order.number,
        message: `Gave up sending this order to the ERP after ${order.attempts} attempts. Retry it with POST /api/orders/retry once the ERP is back.`,
        detail,
      });
    } else if (error instanceof ErpConfigError && order.attempts === 1) {
      await sendOrderAlert({
        kind: "erp_config",
        orderNumber: order.number,
        message:
          "The ERP refused the storefront's credentials (or the ERP isn't configured). Orders are queued.",
        detail,
      });
    } else if (order.attempts === ALERT_AFTER_ATTEMPTS) {
      await sendOrderAlert({
        kind: "failing",
        orderNumber: order.number,
        message: `Still can't send this order to the ERP after ${order.attempts} attempts. Retrying automatically.`,
        detail,
      });
    }
    return "failed";
  }
}

/**
 * Runs the retry queue: every order whose next attempt is due, plus orders
 * stuck "submitting" (crashed worker). Called every minute by a scheduler
 * through POST /api/orders/retry.
 */
export async function retryDueSubmissions(
  db: Db,
  options: { limit?: number; now?: Date } = {},
): Promise<Record<SubmitResult, number>> {
  const now = options.now ?? new Date();
  const due = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      or(
        and(
          inArray(orders.erpStatus, ["pending", "failed"]),
          isNotNull(orders.nextAttemptAt),
          lte(orders.nextAttemptAt, now),
        ),
        and(
          eq(orders.erpStatus, "submitting"),
          lt(orders.lockedAt, new Date(now.getTime() - STALE_LOCK_MS)),
        ),
      ),
    )
    .orderBy(asc(orders.nextAttemptAt))
    .limit(options.limit ?? 20);

  const summary: Record<SubmitResult, number> = {
    submitted: 0,
    failed: 0,
    rejected: 0,
    skipped: 0,
  };
  for (const { id } of due) summary[await submitOrder(db, id, now)]++;
  return summary;
}

/**
 * Puts a failed or rejected order back in the queue for an immediate retry
 * (e.g. after the ERP is fixed or a rejected order was corrected).
 */
export async function requeueOrder(db: Db, number: string, now: Date = new Date()) {
  const [order] = await db
    .update(orders)
    .set({ erpStatus: "pending", nextAttemptAt: now, lockedAt: null, updatedAt: now })
    .where(and(eq(orders.number, number), inArray(orders.erpStatus, ["failed", "rejected"])))
    .returning({ id: orders.id });
  if (order) await event(db, order.id, "requeued", "Put back in the queue by the team");
  return order?.id ?? null;
}

/** Orders the team should look at: failed, rejected, or pending for over 10 minutes. */
export async function listProblemOrders(db: Db, now: Date = new Date()) {
  const rows = await db
    .select({
      number: orders.number,
      erpStatus: orders.erpStatus,
      attempts: orders.attempts,
      lastError: orders.lastError,
      nextAttemptAt: orders.nextAttemptAt,
      total: orders.total,
      currency: orders.currency,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(
      or(
        inArray(orders.erpStatus, ["failed", "rejected"]),
        and(
          inArray(orders.erpStatus, ["pending", "submitting"]),
          lt(orders.createdAt, new Date(now.getTime() - 10 * 60_000)),
        ),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(100);
  return rows;
}
