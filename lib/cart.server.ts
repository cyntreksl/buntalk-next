import "server-only";
import { z } from "zod";
import { ErpError, getProductsForCart, type Product } from "@/lib/erp";
import { lineTotal, sumMoney, variantLabel } from "@/lib/pricing";

/**
 * Server-side cart pricing and checks. The cart itself lives in the visitor's
 * browser, but every price and total the customer is charged comes from here:
 *
 * - Each line is checked against the ERP **live** (no cache): hidden or
 *   deleted products, and sizes that are hidden or sold out, are refused.
 * - Names and unit prices always come from the ERP, never from the browser.
 *   With a signed-in customer, the ERP returns that customer's own prices.
 * - Line totals and the subtotal are calculated here, in cents.
 *
 * Used by POST /api/cart/items and POST /api/cart/validate. Order submission
 * (BUN-164 / BUN-201) must call priceCart() again right before sending the
 * order, and the ERP re-prices the order itself too.
 */

/** Same limit as the quantity stepper. */
export const MAX_QUANTITY = 99;
/** Upper bound for one validate call, so a crafted request can't fan out to the ERP. */
export const MAX_CART_LINES = 50;

export const cartLineSchema = z.object({
  /** The product's slug. */
  productSlug: z.string().trim().min(1).max(200),
  /** The chosen size/variant (SKU link_id). Required when the product has more than one. */
  skuId: z.string().trim().min(1).max(100).optional(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
});

export type CartLineInput = z.infer<typeof cartLineSchema>;

export type PricedCartLine = {
  /** Stable key for this line in the browser cart: product, plus size if any. */
  key: string;
  productSlug: string;
  skuId?: string;
  name: string;
  /** "1 kg", for a product with sizes/variants. */
  variant?: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type RemovedReason = "not_available" | "sold_out" | "choose_variant";

export type PricedCart = {
  /** Lines that can be ordered, priced by the ERP. */
  items: PricedCartLine[];
  /** Lines that can't be ordered, and why. */
  removed: { key: string; reason: RemovedReason }[];
  currency: string;
  /** Sum of the line totals. Offers and delivery are added by BUN-177 / checkout. */
  subtotal: number;
};

export const lineKey = (productSlug: string, skuId?: string) =>
  skuId ? `${productSlug}:${skuId}` : productSlug;

/** Picks the ERP price for one line, or the reason it can't be ordered. */
function priceLine(
  line: CartLineInput,
  product: Product | null | undefined,
): PricedCartLine | RemovedReason {
  if (!product) return "not_available";
  const skus = product.skus ?? [];

  let sku = line.skuId ? skus.find((s) => s.id === line.skuId) : undefined;
  if (line.skuId && !sku) return "not_available"; // size hidden or removed in the ERP
  if (!sku && skus.length === 1) sku = skus[0]; // only one size: no need to choose
  if (!sku && skus.length > 1) return "choose_variant";
  if (sku && !sku.inStock) return "sold_out";

  const unitPrice = sku ? sku.price : product.price;
  return {
    key: lineKey(product.slug, sku?.id),
    productSlug: product.slug,
    skuId: sku?.id,
    name: product.name,
    variant: sku && sku.options.length > 0 ? variantLabel(sku.options) : undefined,
    unitPrice,
    quantity: line.quantity,
    lineTotal: lineTotal(unitPrice, line.quantity),
  };
}

export async function priceCart(
  lines: CartLineInput[],
  options: { customerId?: string | null } = {},
): Promise<PricedCart> {
  const products = await getProductsForCart(
    lines.map((l) => l.productSlug),
    { customerId: options.customerId ?? undefined },
  );

  const result: PricedCart = { items: [], removed: [], currency: "LKR", subtotal: 0 };
  for (const line of lines) {
    const product = products.get(line.productSlug);
    const priced = priceLine(line, product);
    if (typeof priced === "string") {
      result.removed.push({ key: lineKey(line.productSlug, line.skuId), reason: priced });
    } else {
      result.items.push(priced);
      if (product) result.currency = product.currency;
    }
  }
  result.subtotal = sumMoney(result.items.map((i) => i.lineTotal));
  return result;
}

export const removedMessages: Record<RemovedReason, string> = {
  not_available: "Sorry, this product is no longer available online.",
  sold_out: "Sorry, this size is sold out.",
  choose_variant: "Please choose a size first.",
};

/** JSON error for the cart API routes. ERP problems become a 503 with a customer-safe message. */
export function cartErrorResponse(error: unknown): Response {
  if (error instanceof ErpError) {
    console.error("[cart] ERP check failed", error);
    return Response.json({ error: "unavailable", message: error.userMessage }, { status: 503 });
  }
  throw error;
}
