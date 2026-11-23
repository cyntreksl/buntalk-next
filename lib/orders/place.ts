import "server-only";
import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import { priceCart, removedMessages, type RemovedReason } from "@/lib/cart.server";
import type { Db } from "@/lib/db";
import { orderEvents, orders, type Order } from "@/lib/db/schema";
import type { PlaceOrderInput } from "./input";

/**
 * Places a storefront order: re-prices the cart from the ERP on the server,
 * then saves the order (a snapshot of lines, prices, offers, customer and
 * delivery details) before anything is sent to the ERP. Sending is a separate
 * step (submitOrder), so an ERP outage never loses an order.
 *
 * Idempotent: the same idempotencyKey (one checkout attempt) always returns
 * the same order, even if the browser sends it twice at the same moment.
 */

export class OrderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

/** No 0/O/1/I/L, so order numbers are easy to read out over the phone. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** "BT-261122-7K3QX": BT, the date (YYMMDD, Sri Lanka time) and 5 random characters. */
export function newOrderNumber(now = new Date()): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replaceAll("-", "");
  const suffix = Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `BT-${day}-${suffix}`;
}

export async function placeOrder(
  db: Db,
  input: PlaceOrderInput,
  options: { customerId?: string | null } = {},
): Promise<{ order: Order; created: boolean }> {
  const existing = await findByKey(db, input.idempotencyKey);
  if (existing) return { order: existing, created: false };

  // Server-side pricing from the ERP (prices, offers, totals). Never the browser's numbers.
  const cart = await priceCart(input.lines, { customerId: options.customerId });
  if (cart.removed.length > 0) {
    throw new OrderError(
      "Some items in your cart can't be ordered any more. Please review your cart.",
      409,
      "cart_changed",
      cart.removed.map((r) => ({ ...r, message: removedMessages[r.reason as RemovedReason] })),
    );
  }
  if (cart.items.length === 0) throw new OrderError("Your cart is empty.", 400, "empty_cart");
  // A quantity outside the line's limits is never changed silently on an order (BUN-175).
  if (cart.items.some((i) => i.adjusted)) {
    throw new OrderError(
      "Some quantities in your cart are over the limit. Please review your cart.",
      409,
      "cart_changed",
    );
  }
  // Cake Studio designs can't be sent to the ERP yet (BUN-184, ERP ticket BUN-252).
  if (cart.items.some((i) => i.customization)) {
    throw new OrderError(
      "Cake Studio cakes can't be ordered online yet. Please remove them from your cart.",
      409,
      "customization_unsupported",
    );
  }

  // TODO(delivery fees ticket): delivery fees come from the ERP / delivery rules; none yet.
  const deliveryFee = 0;

  for (let attempt = 0; attempt < 3; attempt++) {
    const [order] = await db
      .insert(orders)
      .values({
        number: newOrderNumber(),
        idempotencyKey: input.idempotencyKey,
        customer: {
          name: input.customer.name,
          phone: input.customer.phone,
          email: input.customer.email,
          erpCustomerId: options.customerId ?? undefined,
        },
        fulfilment: input.fulfilment,
        lines: cart.items.map((i) => ({
          productId: i.productId,
          productSlug: i.productSlug,
          skuId: i.skuId,
          name: i.name,
          variant: i.variant,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineSubtotal: i.lineSubtotal,
          discount: i.discount,
          lineTotal: i.lineTotal,
          schemeIds: i.schemes.map((s) => s.id),
        })),
        appliedSchemes: cart.appliedSchemes,
        freeItems: cart.freeItems,
        payment: { method: input.payment.method, status: "pending" },
        note: input.note,
        currency: cart.currency,
        subtotal: cart.subtotal,
        discountTotal: cart.discountTotal,
        deliveryFee,
        total: cart.total + deliveryFee,
      })
      .onConflictDoNothing()
      .returning();

    if (order) {
      await db.insert(orderEvents).values({
        orderId: order.id,
        type: "placed",
        message: `Order placed: ${order.lines.length} line(s), total ${order.currency} ${order.total.toFixed(2)}`,
      });
      return { order, created: true };
    }

    // Conflict: either the same checkout was sent twice (return that order),
    // or the random order number was already taken (try another number).
    const same = await findByKey(db, input.idempotencyKey);
    if (same) return { order: same, created: false };
  }
  throw new OrderError("Could not create an order number. Please try again.", 503, "number_clash");
}

async function findByKey(db: Db, key: string): Promise<Order | undefined> {
  const [row] = await db.select().from(orders).where(eq(orders.idempotencyKey, key)).limit(1);
  return row;
}
