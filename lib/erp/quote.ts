import "server-only";
import { erpRequest } from "./http";
import { erpQuoteSchema, one } from "./schemas";

/**
 * Asks the ERP scheme engine to price a basket: unit prices, which schemes
 * apply, each line's discount, order-level discounts, free items and totals.
 *
 * Live (never cached): it's the same evaluation the ERP applies to the order,
 * so expired or inactive schemes are never applied, and what the cart shows
 * matches what the customer is charged. Read-only, so it's retried like a GET.
 */

export type QuoteLineInput = {
  productId: string;
  skuId?: string;
  quantity: number;
};

export type Quote = {
  currency: string;
  lines: {
    productId: string;
    skuId?: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
    schemeIds: string[];
  }[];
  appliedSchemes: { schemeId: string; name: string; description?: string; discount: number }[];
  freeItems: {
    schemeId: string;
    productId: string;
    skuId?: string;
    name: string;
    variant?: string;
    quantity: number;
  }[];
  subtotal: number;
  discountTotal: number;
  total: number;
};

export async function quoteCart(
  lines: QuoteLineInput[],
  options: { customerId?: string } = {},
): Promise<Quote> {
  const { data } = await erpRequest({
    method: "POST",
    path: "/prices/quote",
    readOnly: true,
    schema: one(erpQuoteSchema),
    body: {
      customer_link_id: options.customerId ?? null,
      lines: lines.map((l) => ({
        product_link_id: l.productId,
        sku_link_id: l.skuId ?? null,
        quantity: l.quantity,
      })),
    },
  });

  return {
    currency: data.currency,
    lines: data.lines.map((l) => ({
      productId: l.product_link_id,
      skuId: l.sku_link_id ?? undefined,
      quantity: l.quantity,
      unitPrice: l.unit_price,
      discount: l.discount,
      lineTotal: l.line_total,
      schemeIds: l.scheme_ids,
    })),
    appliedSchemes: data.applied_schemes.map((s) => ({
      schemeId: s.scheme_id,
      name: s.name,
      description: s.description ?? undefined,
      discount: s.discount,
    })),
    freeItems: data.free_items.map((f) => ({
      schemeId: f.scheme_id,
      productId: f.product_link_id,
      skuId: f.sku_link_id ?? undefined,
      name: f.product_name,
      variant: f.sku_label ?? undefined,
      quantity: f.quantity,
    })),
    subtotal: data.subtotal,
    discountTotal: data.discount_total,
    total: data.total,
  };
}
