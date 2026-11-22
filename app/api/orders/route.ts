import { z } from "zod";
import { getCustomerId } from "@/lib/auth";
import { cartErrorResponse } from "@/lib/cart.server";
import { getDb } from "@/lib/db";
import type { Order } from "@/lib/db/schema";
import { OrderError, placeOrder, placeOrderSchema, submitOrder } from "@/lib/orders";

/**
 * Places an order (called by the checkout page, BUN-201).
 *
 *   POST /api/orders
 *   { idempotencyKey, lines: [{ productSlug, skuId?, quantity }], customer: { name, phone, email? },
 *     fulfilment: { type: "delivery", address, date?, slot? } | { type: "pickup", outletId, date?, slot? },
 *     payment: { method }, note? }
 *
 *   201 { order }   placed (and sent to the ERP if it answered in time)
 *   200 { order }   the same idempotencyKey again: the existing order, nothing new created
 *   409 cart_changed (items hidden, sold out or removed) · 400 invalid · 503 ERP unavailable for pricing
 *
 * The order is priced by the ERP on the server and saved first, then sent to
 * the ERP straight away. If the ERP can't take it right now, the order is
 * still placed: the retry queue sends it later (POST /api/orders/retry).
 */

/** What the customer sees: no internal ids, errors or attempt counts. */
function publicOrder(order: Order) {
  return {
    number: order.number,
    /** "received" until the ERP has it, then "confirmed". */
    status: order.erpStatus === "submitted" ? "confirmed" : "received",
    erpOrderNumber: order.erpOrderNumber,
    currency: order.currency,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    lines: order.lines.map((l) => ({
      name: l.name,
      variant: l.variant,
      quantity: l.quantity,
      lineTotal: l.lineTotal,
    })),
  };
}

export async function POST(request: Request) {
  const parsed = placeOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", details: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const db = await getDb();
    const { order, created } = await placeOrder(db, parsed.data, {
      customerId: await getCustomerId(),
    });
    // First attempt straight away; failures stay queued for the retry worker.
    if (created) await submitOrder(db, order.id);
    const [latest] = await db.query.orders.findMany({
      where: (o, { eq }) => eq(o.id, order.id),
      limit: 1,
    });
    return Response.json(
      { order: publicOrder(latest ?? order) },
      { status: created ? 201 : 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof OrderError) {
      return Response.json(
        { error: error.code, message: error.message, details: error.details },
        { status: error.status },
      );
    }
    return cartErrorResponse(error);
  }
}
