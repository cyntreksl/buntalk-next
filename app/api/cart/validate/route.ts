import { z } from "zod";
import { getCustomerId } from "@/lib/auth";
import { MAX_CART_LINES, cartErrorResponse, cartLineSchema, priceCart } from "@/lib/cart.server";

/**
 * Re-prices a whole cart from the ERP (the cart and checkout pages call this
 * when they open).
 *
 *   POST /api/cart/validate   { "items": [{ "productSlug": "…", "skuId": "…", "quantity": 2 }, …] }
 *
 *   200 {
 *     items:    [{ key, productSlug, skuId, name, variant, unitPrice, quantity, lineTotal }],
 *     removed:  [{ key, reason: "not_available" | "sold_out" | "choose_variant" }],
 *     currency: "LKR",
 *     subtotal: 1234.5
 *   }
 *
 * Unit prices are the ERP's current prices (the signed-in customer's own, if
 * any). Line totals and the subtotal are calculated here on the server.
 */
const bodySchema = z.object({ items: z.array(cartLineSchema).max(MAX_CART_LINES) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", details: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const cart = await priceCart(parsed.data.items, { customerId: await getCustomerId() });
    return Response.json(cart, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return cartErrorResponse(error);
  }
}
