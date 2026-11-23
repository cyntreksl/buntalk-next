import "server-only";
import { z } from "zod";
import {
  ErpError,
  ErpNotFoundError,
  ErpResponseError,
  ErpValidationError,
  getCakeDesign,
  getCakeStudioMenu,
  getProductsForCart,
  quoteCart,
  type CakeDesign,
  type Product,
  type Quote,
  type SavedCakeDesign,
} from "@/lib/erp";
import { cakePreview, cakeSummary, PREVIEW_URL } from "@/lib/cake-studio/cart.server";
import { clampQuantity, lineKey, quantityLimits, type Limits } from "@/lib/cart/limits";
import { lineTotal, sumMoney, variantLabel } from "@/lib/pricing";

export { MAX_CART_LINES, MAX_QUANTITY } from "@/lib/cart/limits";

/**
 * Server-side cart pricing and checks. The cart itself lives in the visitor's
 * browser, but every price and total the customer is charged comes from here:
 *
 * - Each line is checked against the ERP **live** (no cache): hidden or
 *   deleted products, and sizes that are hidden or sold out, are refused.
 * - Names and unit prices always come from the ERP, never from the browser.
 *   With a signed-in customer, the ERP returns that customer's own prices.
 * - Discounts come from the ERP scheme engine (quoteCart): which scheme gave
 *   which discount, free items, and the totals. The storefront never applies
 *   a scheme itself, so the cart matches what the ERP charges for the order.
 *
 * - Cake Studio cakes (BUN-184) are priced from their saved design: the
 *   ERP's Cake Studio price for exactly that cake, priced again every time.
 *   The summary and picture shown come from the ERP's design too. Offers
 *   (schemes) aren't applied to designed cakes.
 *
 * Used by POST /api/cart/items and POST /api/cart/validate. Order submission
 * (BUN-164 / BUN-201) must call priceCart() again right before sending the
 * order, and the ERP re-prices the order itself too.
 */

/**
 * A Cake Studio design on a cart line (BUN-184). The design itself is saved
 * in the ERP's Cake Studio; the cart keeps its id, and a summary and picture
 * to show ("Flavour: Chocolate sponge", "Message: Happy birthday"). The server
 * replaces the summary and picture with the ERP's when it checks the line.
 */
export const customizationSchema = z.object({
  designId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  summary: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  /** Picture of the design, shown in the cart. An https URL or a path on this site. */
  previewUrl: z.string().max(500).regex(PREVIEW_URL).optional(),
});
export type Customization = z.infer<typeof customizationSchema>;

export const cartLineSchema = z.object({
  /** The product's slug. */
  productSlug: z.string().trim().min(1).max(200),
  /** The chosen size/variant (SKU link_id). Required when the product has more than one. */
  skuId: z.string().trim().min(1).max(100).optional(),
  /** Quantity (to add, for POST /api/cart/items). Kept within the line's limits. */
  quantity: z.number().int().min(1).max(999),
  /** Adding: how many of this line are already in the cart, so the total stays within the limits. */
  inCart: z.number().int().min(0).max(999).optional(),
  /** Cake Studio design, required for customizable products. */
  customization: customizationSchema.optional(),
});

export type CartLineInput = z.infer<typeof cartLineSchema>;

export type PricedCartLine = {
  /** Stable key for this line in the browser cart: product, plus size if any. */
  key: string;
  productSlug: string;
  /** ERP product link_id (null only for local sample data). */
  productId: string | null;
  skuId?: string;
  name: string;
  /** "1 kg", for a product with sizes/variants. */
  variant?: string;
  /** Cake Studio design (customizable products). */
  customization?: Customization;
  /** A designed cake (BUN-184): the full design, for the order sent to the ERP. */
  cake?: { designId: string; config: CakeDesign; summary: string[] };
  /** The size's photo, else the product's main photo (BUN-176). */
  imageUrl?: string;
  unitPrice: number;
  /** Within the line's limits (see `adjusted`). */
  quantity: number;
  /** Allowed quantities for this line (ERP limits, BUN-259, within 1–99). */
  limits: Limits;
  /** True when the quantity asked for was outside the limits and was changed. */
  adjusted: boolean;
  /** quantity × unitPrice, before offers. */
  lineSubtotal: number;
  /** Discount on this line from schemes (0 if none). */
  discount: number;
  /** lineSubtotal − discount. */
  lineTotal: number;
  /** Schemes that gave this line's discount. */
  schemes: { id: string; name: string }[];
};

export type RemovedReason =
  "not_available" | "sold_out" | "choose_variant" | "customize_first" | "design_unavailable";

export type PricedCart = {
  /** Lines that can be ordered, priced by the ERP. */
  items: PricedCartLine[];
  /** Lines that can't be ordered, and why. */
  removed: { key: string; reason: RemovedReason }[];
  /** Every scheme the ERP applied, and how much it saved. */
  appliedSchemes: { id: string; name: string; description?: string; discount: number }[];
  /** Free items given by schemes. */
  freeItems: { name: string; variant?: string; quantity: number; schemeName: string }[];
  currency: string;
  /** Before discounts. */
  subtotal: number;
  discountTotal: number;
  /** What the customer pays for the items. Delivery is added at checkout. */
  total: number;
};

export { lineKey } from "@/lib/cart/limits";

/** Picks the ERP price for one line, or the reason it can't be ordered. */
function priceLine(
  line: CartLineInput,
  product: Product | null | undefined,
  /** The line's saved Cake Studio design (null: unknown, or no longer possible), and its size's SKU. */
  design?: { saved: SavedCakeDesign | null; skuId?: string },
): PricedCartLine | RemovedReason {
  if (!product) return "not_available";
  const skus = product.skus ?? [];

  let sku = line.skuId ? skus.find((s) => s.id === line.skuId) : undefined;
  if (line.skuId && !sku) return "not_available"; // size hidden or removed in the ERP
  if (!sku && skus.length === 1) sku = skus[0]; // only one size: no need to choose
  if (!sku && skus.length > 1) return "choose_variant";
  if (sku && !sku.inStock) return "sold_out";
  // Cake Studio products are designed first (BUN-184); a design on anything else is ignored.
  if (product.customizable && !line.customization) return "customize_first";
  let customization: Customization | undefined;
  let cake: PricedCartLine["cake"];
  let unitPrice = sku ? sku.price : product.price;
  if (product.customizable && line.customization) {
    const saved = design?.saved;
    if (!saved) return "design_unavailable";
    // The design's cake size must be the line's size (sku_link_id), or it's a different cake.
    if (!sku || design.skuId !== sku.id) return "not_available";
    const summary = cakeSummary(saved);
    customization = { designId: saved.id, summary, previewUrl: cakePreview(saved) };
    cake = { designId: saved.id, config: saved.design, summary };
    unitPrice = saved.total;
  }

  const limits = quantityLimits(product, sku);
  const wanted = (line.inCart ?? 0) + line.quantity;
  const quantity = clampQuantity(wanted, limits);
  return {
    key: lineKey(product.slug, sku?.id, customization?.designId),
    productSlug: product.slug,
    productId: product.id ?? null,
    skuId: sku?.id,
    name: product.name,
    variant: sku && sku.options.length > 0 ? variantLabel(sku.options) : undefined,
    customization,
    cake,
    imageUrl: sku?.imageUrl ?? product.imageUrls?.[0],
    unitPrice,
    quantity,
    limits,
    adjusted: quantity !== wanted,
    lineSubtotal: lineTotal(unitPrice, quantity),
    discount: 0,
    lineTotal: lineTotal(unitPrice, quantity),
    schemes: [],
  };
}

/**
 * Applies the ERP quote (scheme engine) to the product lines (not designed
 * cakes, which keep their Cake Studio price). Totals add the cakes back in.
 */
function applyQuote(
  cart: PricedCart,
  lines: PricedCartLine[],
  products: Product[],
  cakes: PricedCartLine[],
  quote: Quote,
) {
  if (quote.lines.length !== lines.length) {
    throw new ErpResponseError("quote lines don't match the request", "/prices/quote", 200);
  }
  const names = new Map(quote.appliedSchemes.map((s) => [s.schemeId, s.name]));
  const quoted = new Map(
    lines.map((line, i) => {
      const q = quote.lines[i];
      if (q.productId !== products[i].id) {
        throw new ErpResponseError("quote lines are out of order", "/prices/quote", 200);
      }
      return [
        line,
        {
          ...line,
          unitPrice: q.unitPrice,
          lineSubtotal: lineTotal(q.unitPrice, q.quantity),
          discount: q.discount,
          lineTotal: q.lineTotal,
          schemes: q.schemeIds.map((id) => ({ id, name: names.get(id) ?? "Offer" })),
        },
      ];
    }),
  );
  cart.items = cart.items.map((line) => quoted.get(line) ?? line);
  cart.appliedSchemes = quote.appliedSchemes.map((s) => ({
    id: s.schemeId,
    name: s.name,
    description: s.description,
    discount: s.discount,
  }));
  cart.freeItems = quote.freeItems.map((f) => ({
    name: f.name,
    variant: f.variant,
    quantity: f.quantity,
    schemeName: names.get(f.schemeId) ?? "Offer",
  }));
  const cakeTotal = sumMoney(cakes.map((c) => c.lineTotal));
  cart.currency = quote.currency;
  cart.subtotal = sumMoney([quote.subtotal, cakeTotal]);
  cart.discountTotal = quote.discountTotal;
  cart.total = sumMoney([quote.total, cakeTotal]);
}

/** The saved designs on the cart's Cake Studio lines, priced again now (null: unknown or no longer possible). */
async function loadDesigns(
  lines: CartLineInput[],
  customerId: string | undefined,
): Promise<Map<string, { saved: SavedCakeDesign | null; skuId?: string }>> {
  const ids = [
    ...new Set(lines.flatMap((l) => (l.customization ? [l.customization.designId] : []))),
  ];
  if (ids.length === 0) return new Map();
  const menu = await getCakeStudioMenu();
  type Loaded = { saved: SavedCakeDesign | null; skuId?: string };
  const entries = await Promise.all(
    ids.map(async (id): Promise<[string, Loaded]> => {
      try {
        const saved = await getCakeDesign(id, { customerId });
        const skuId = menu.sizes.find((s) => s.id === saved.design.size_id)?.skuLinkId;
        return [id, { saved, skuId }];
      } catch (error) {
        if (error instanceof ErpNotFoundError || error instanceof ErpValidationError) {
          return [id, { saved: null }];
        }
        throw error;
      }
    }),
  );
  return new Map(entries);
}

export async function priceCart(
  lines: CartLineInput[],
  options: { customerId?: string | null } = {},
): Promise<PricedCart> {
  const customerId = options.customerId ?? undefined;
  const products = await getProductsForCart(
    lines.map((l) => l.productSlug),
    { customerId },
  );
  // Designs only for Cake Studio products (a design on anything else is ignored).
  const designs = await loadDesigns(
    lines.filter((l) => products.get(l.productSlug)?.customizable),
    customerId,
  );

  const cart: PricedCart = {
    items: [],
    removed: [],
    appliedSchemes: [],
    freeItems: [],
    currency: "LKR",
    subtotal: 0,
    discountTotal: 0,
    total: 0,
  };
  const ok: { line: PricedCartLine; product: Product }[] = [];
  for (const line of lines) {
    const product = products.get(line.productSlug);
    const design = line.customization ? designs.get(line.customization.designId) : undefined;
    const priced = priceLine(line, product, design);
    if (typeof priced === "string") {
      cart.removed.push({
        key: lineKey(line.productSlug, line.skuId, line.customization?.designId),
        reason: priced,
      });
    } else if (product) {
      ok.push({ line: priced, product });
      cart.currency = product.currency;
    }
  }
  cart.items = ok.map((o) => o.line);
  cart.subtotal = sumMoney(cart.items.map((i) => i.lineTotal));
  cart.total = cart.subtotal;

  // Discounts: evaluated by the ERP scheme engine, live, for product lines
  // (designed cakes keep their Cake Studio price). Local sample data has no
  // ERP ids (and no schemes), so there is nothing to evaluate.
  const regular = ok.filter((o) => !o.line.cake);
  const cakes = ok.filter((o) => o.line.cake).map((o) => o.line);
  if (regular.length > 0 && regular.every((o) => o.product.id)) {
    const quote = await quoteCart(
      regular.map((o) => ({
        productId: o.product.id!,
        skuId: o.line.skuId,
        quantity: o.line.quantity,
      })),
      { customerId },
    );
    applyQuote(
      cart,
      regular.map((o) => o.line),
      regular.map((o) => o.product),
      cakes,
      quote,
    );
  }
  return cart;
}

export const removedMessages: Record<RemovedReason, string> = {
  not_available: "Sorry, this product is no longer available online.",
  sold_out: "Sorry, this size is sold out.",
  choose_variant: "Please choose a size first.",
  customize_first: "Please design this cake in Cake Studio first.",
  design_unavailable:
    "This cake design can't be made any more (an option was taken off the menu). Please design it again in Cake Studio.",
};

/** JSON error for the cart API routes. ERP problems become a 503 with a customer-safe message. */
export function cartErrorResponse(error: unknown): Response {
  if (error instanceof ErpError) {
    console.error("[cart] ERP check failed", error);
    return Response.json({ error: "unavailable", message: error.userMessage }, { status: 503 });
  }
  throw error;
}
