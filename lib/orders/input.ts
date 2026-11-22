import { z } from "zod";
import { MAX_CART_LINES, cartLineSchema } from "@/lib/cart.server";
import { normalizePhone } from "@/lib/customers/phone";

/**
 * What the checkout page sends to place an order (POST /api/orders).
 * Prices are never part of it: the server re-prices every line from the ERP.
 */

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(max).optional());

/**
 * Sri Lankan phone numbers, local (07x…) or international (+94…), spaces and
 * dashes allowed. Stored as +94… (the same format as customer accounts) so
 * the ERP matches the same customer.
 */
export const phoneSchema = z.string().transform((v, ctx) => {
  const phone = normalizePhone(v);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: "Enter a valid phone number, e.g. 077 123 4567" });
    return z.NEVER;
  }
  return phone;
});
const phone = phoneSchema;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const placeOrderSchema = z.object({
  /** Generated once per checkout attempt in the browser; resending it never creates a second order. */
  idempotencyKey: z.uuid(),
  lines: z.array(cartLineSchema).min(1, "Your cart is empty.").max(MAX_CART_LINES),
  customer: z.object({
    name: trimmed(120),
    phone,
    email: z.preprocess((v) => (v === "" ? undefined : v), z.email().max(200).optional()),
  }),
  fulfilment: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("delivery"),
      address: z.object({
        line1: trimmed(200),
        line2: optionalText(200),
        city: trimmed(100),
        notes: optionalText(300),
      }),
      date: date.optional(),
      slot: optionalText(50),
    }),
    z.object({
      type: z.literal("pickup"),
      outletId: trimmed(100),
      date: date.optional(),
      slot: optionalText(50),
    }),
  ]),
  payment: z.object({ method: z.enum(["cash_on_delivery", "card"]) }),
  note: optionalText(500),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
