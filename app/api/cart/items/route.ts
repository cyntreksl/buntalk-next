import { z } from "zod";
import { getCustomerId } from "@/lib/auth";
import { cartErrorResponse, cartLineSchema, priceCart, removedMessages } from "@/lib/cart.server";

/**
 * Checks and prices one product before it goes into the cart.
 *
 *   POST /api/cart/items   { "productSlug": "chocolate-cake", "skuId": "<SKU link_id>", "quantity": 2 }
 *
 *   200 { item: { key, productSlug, skuId, name, variant, unitPrice, quantity, lineTotal } }
 *   404 { error: "not_available", message }   hidden in the ERP, or doesn't exist
 *   409 { error: "sold_out" | "choose_variant", message }
 *   400 invalid body · 503 ERP unavailable
 *
 * Always asks the ERP live, so a hidden product can't be added even by
 * calling this endpoint directly. The price comes from the ERP (the signed-in
 * customer's own price, if they have one); any price the browser sends is ignored.
 */
export async function POST(request: Request) {
  const parsed = cartLineSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", details: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const cart = await priceCart([parsed.data], { customerId: await getCustomerId() });
    const item = cart.items[0];
    if (!item) {
      const reason = cart.removed[0]?.reason ?? "not_available";
      return Response.json(
        { error: reason, message: removedMessages[reason] },
        { status: reason === "not_available" ? 404 : 409 },
      );
    }
    return Response.json({ item, currency: cart.currency });
  } catch (error) {
    return cartErrorResponse(error);
  }
}
