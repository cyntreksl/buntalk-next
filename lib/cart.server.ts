import "server-only";
import { z } from "zod";
import { ErpError, getProductsForCart } from "@/lib/erp";

/**
 * Server-side cart check. The cart itself lives in the visitor's browser, but
 * nothing gets into it (or through checkout) without passing this check
 * against the ERP: hidden or deleted products are refused, and names and
 * prices always come from the ERP, never from the browser.
 *
 * Used by POST /api/cart/items and POST /api/cart/validate; checkout reuses it.
 */

/** Same limit as the quantity stepper. */
export const MAX_QUANTITY = 99;
/** Upper bound for one validate call, so a crafted request can't fan out to the ERP. */
export const MAX_CART_LINES = 50;

export const cartLineSchema = z.object({
  /** The product's slug (the cart's item key). */
  sku: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
});

export type CartLineInput = z.infer<typeof cartLineSchema>;

export type CheckedCartLine = {
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export type CartCheck = {
  /** Lines that can be ordered, with the ERP's current name and price. */
  items: CheckedCartLine[];
  /** Lines that were dropped because the product is hidden or no longer exists. */
  removed: { sku: string }[];
};

export async function checkCartLines(lines: CartLineInput[]): Promise<CartCheck> {
  const products = await getProductsForCart(lines.map((l) => l.sku));
  const result: CartCheck = { items: [], removed: [] };
  for (const line of lines) {
    const product = products.get(line.sku);
    if (product) {
      result.items.push({
        sku: product.slug,
        name: product.name,
        unitPrice: product.price,
        quantity: line.quantity,
      });
    } else {
      result.removed.push({ sku: line.sku });
    }
  }
  return result;
}

/** JSON error for the cart API routes. ERP problems become a 503 with a customer-safe message. */
export function cartErrorResponse(error: unknown): Response {
  if (error instanceof ErpError) {
    console.error("[cart] ERP check failed", error);
    return Response.json({ error: "unavailable", message: error.userMessage }, { status: 503 });
  }
  throw error;
}
