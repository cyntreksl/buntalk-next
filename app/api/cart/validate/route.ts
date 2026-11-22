import { z } from "zod";
import {
  MAX_CART_LINES,
  cartErrorResponse,
  cartLineSchema,
  checkCartLines,
} from "@/lib/cart.server";

/**
 * Re-checks a whole cart against the ERP (the cart page calls this on open).
 *
 *   POST /api/cart/validate   { "items": [{ "sku": "<product slug>", "quantity": 2 }, …] }
 *
 *   200 { items: [{ sku, name, unitPrice, quantity }], removed: [{ sku }] }
 *
 * `removed` lists products that were hidden in the ERP (or deleted) since they
 * were added; the browser drops them. Names and prices are refreshed from the ERP.
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
    return Response.json(await checkCartLines(parsed.data.items));
  } catch (error) {
    return cartErrorResponse(error);
  }
}
