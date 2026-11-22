import { z } from "zod";
import { cartErrorResponse, cartLineSchema, checkCartLines } from "@/lib/cart.server";

/**
 * Checks one product before it goes into the cart.
 *
 *   POST /api/cart/items   { "sku": "<product slug>", "quantity": 2 }
 *
 *   200 { item: { sku, name, unitPrice, quantity } }   name and price from the ERP
 *   404 { error: "not_available", message }           hidden in the ERP, or doesn't exist
 *   400 invalid body · 503 ERP unavailable
 *
 * Always asks the ERP live, so a product hidden in the ERP can't be added,
 * even by calling this endpoint directly.
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
    const { items } = await checkCartLines([parsed.data]);
    const item = items[0];
    if (!item) {
      return Response.json(
        { error: "not_available", message: "Sorry, this product is no longer available online." },
        { status: 404 },
      );
    }
    return Response.json({ item });
  } catch (error) {
    return cartErrorResponse(error);
  }
}
