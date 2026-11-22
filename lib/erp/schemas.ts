import { z } from "zod";

/**
 * ERP entity shapes ("wire" types), exactly as the ERP storefront API sends
 * them: snake_case, money as decimal strings, IDs as UUIDs (`link_id`).
 * See docs/erp-api-contract.md for the full contract.
 *
 * Every response is checked against these schemas (lib/erp/http.ts), so a
 * change on the ERP side shows up as a clear ErpResponseError instead of
 * broken pages. lib/erp/mappers.ts turns them into storefront types.
 *
 * Field names follow the ERP's own models (EndProduct, EndProductCategory,
 * EndProductSku, ProductPriceVersion, PosCustomer, PosOrder, …). Fields
 * marked NEW don't exist in the ERP yet and are part of the proposed contract.
 */

/** Money: the ERP sends decimals as strings ("1250.00"); numbers are accepted too. */
const money = z.union([z.string().regex(/^-?\d+(\.\d+)?$/), z.number()]).transform(Number);
const uuid = z.string().min(1);
const isoDateTime = z.string().min(1);

/** Resolved price for a product or SKU (from ProductPriceVersion values). */
export const erpPriceSchema = z.object({
  currency: z.string().length(3),
  /** What the customer pays (after any scheme/offer price). */
  selling_price: money,
  /** Price printed on the pack (MRP). */
  printed_price: money.nullable(),
  /** NEW: original price when a scheme lowers the selling price (BUN-174). */
  compare_at_price: money.nullable().optional(),
  tax_mode: z.string().nullable().optional(),
});

/**
 * Image URL. A missing or malformed URL becomes null instead of failing the
 * whole response, so the page shows a placeholder image (BUN-160).
 */
const imageUrl = z.url().nullable().optional().catch(null);

export const erpCategorySchema = z.object({
  link_id: uuid,
  /** NEW: URL slug, unique per tenant. */
  slug: z.string().min(1),
  name: z.string(),
  /** NEW */
  description: z.string().nullable().optional(),
  /** NEW: absolute image URL. */
  image_url: imageUrl,
  /** NEW: parent category's link_id; null for a top-level category. */
  parent_link_id: uuid.nullable().optional(),
  /** NEW: display order set in the ERP (lower first). The storefront never re-sorts. */
  sort_order: z.number().int().optional(),
  is_active: z.boolean(),
  /**
   * NEW: "Show on the website" switch in the ERP. Missing means visible, so the
   * storefront works before the ERP adds the field; `is_active: false` always hides.
   */
  visible_online: z.boolean().optional(),
});

export const erpSkuOptionSchema = z.object({
  type: z.string(),
  value: z.string(),
});

export const erpSkuSchema = z.object({
  link_id: uuid,
  code: z.string(),
  barcode: z.string().nullable().optional(),
  /** Option values that make this SKU, e.g. [{ type: "Size", value: "Large" }]. */
  options: z.array(erpSkuOptionSchema).default([]),
  base_quantity: money,
  is_active: z.boolean(),
  /** NEW: a single size/variant can be hidden online on its own. Missing means visible. */
  visible_online: z.boolean().optional(),
  /** NEW: whether this SKU can be ordered online now. */
  in_stock: z.boolean().optional(),
  price: erpPriceSchema,
});

export const erpProductSchema = z.object({
  link_id: uuid,
  code: z.string(),
  /** NEW: URL slug, unique per tenant. */
  slug: z.string().min(1),
  name: z.string(),
  description: z.string().nullable(),
  category: erpCategorySchema.pick({ link_id: true, slug: true, name: true }),
  /** Product photo (EndProduct::imageUrl(), as in the staff API's EndProductResource). */
  image_url: imageUrl,
  /** NEW: extra photos, after the main one. */
  gallery_urls: z.array(z.string()).default([]),
  /**
   * The product's options with all their values (EndProduct option types /
   * values), e.g. [{ name: "Size", values: ["Small", "Large"] }].
   */
  attributes: z.array(z.object({ name: z.string(), values: z.array(z.string()) })).default([]),
  /** NEW: how long the bakery needs to prepare it, in hours (shown as "Ready in …"). */
  processing_time_hours: z.number().nonnegative().nullable().optional(),
  is_active: z.boolean(),
  /**
   * NEW: "Show on the website" switch in the ERP. Missing means visible, so the
   * storefront works before the ERP adds the field; `is_active: false` always hides.
   */
  visible_online: z.boolean().optional(),
  is_customisable: z.boolean().default(false),
  allows_fractional: z.boolean().default(false),
  /** NEW: shown in "Featured" on the home page. */
  is_featured: z.boolean().default(false),
  /** Default (product-level) price. */
  price: erpPriceSchema,
  skus: z.array(erpSkuSchema).default([]),
});

/** NEW: storefront banner (the ERP's PosDisplaySlide is the closest existing model). */
export const erpBannerSchema = z.object({
  link_id: uuid,
  title: z.string(),
  subtitle: z.string().nullable().optional(),
  cta_label: z.string(),
  href: z.string().min(1),
  image_url: imageUrl,
  image_alt: z.string().nullable().optional(),
});

/** Scheme / offer (PosOccasionOffer, PosGroupDiscount). Applied by the ERP scheme engine (BUN-163). */
export const erpSchemeSchema = z.object({
  link_id: uuid,
  name: z.string(),
  /** NEW: short customer-facing text, e.g. "Buy 2 fish buns, get 1 free". */
  description: z.string().nullable().optional(),
  kind: z.enum(["percent", "amount", "free_item", "fixed_price", "buy_x_get_y"]),
  /** Percent, amount off, or the fixed price. Null for free_item / buy_x_get_y. */
  reward_value: money.nullable().optional(),
  /** buy_x_get_y: buy this many… */
  buy_quantity: z.number().int().positive().nullable().optional(),
  /** …get this many free. */
  get_quantity: z.number().int().positive().nullable().optional(),
  /** free_item: the SKU given free. */
  free_sku_id: uuid.nullable().optional(),
  min_spend: money.nullable().optional(),
  starts_at: isoDateTime.nullable().optional(),
  ends_at: isoDateTime.nullable().optional(),
  /** Product link_ids the scheme applies to. Empty with no categories = whole order. */
  product_ids: z.array(uuid).default([]),
  /** Category link_ids the scheme applies to (and their sub-categories). */
  category_ids: z.array(uuid).default([]),
  /**
   * NEW: who can get it. "everyone", or "customer_groups" (group discounts,
   * birthday offers): only shown to and applied for eligible customers.
   */
  audience: z.enum(["everyone", "customer_groups"]).default("everyone"),
  is_active: z.boolean(),
});

/** NEW: POST /prices/quote, the ERP's evaluation of a basket. */
export const erpQuoteLineSchema = z.object({
  product_link_id: uuid,
  sku_link_id: uuid.nullable().optional(),
  quantity: z.number().positive(),
  unit_price: money,
  /** Discount on this line from line-level schemes (0 if none). */
  discount: money,
  /** quantity × unit_price − discount. */
  line_total: money,
  /** Schemes that gave this line's discount. */
  scheme_ids: z.array(uuid).default([]),
});

export const erpQuoteSchema = z.object({
  currency: z.string().length(3),
  /** Same order as the request lines. */
  lines: z.array(erpQuoteLineSchema),
  /** Every scheme applied, with how much it saved in total (line and order level). */
  applied_schemes: z
    .array(
      z.object({
        scheme_id: uuid,
        name: z.string(),
        description: z.string().nullable().optional(),
        discount: money,
      }),
    )
    .default([]),
  /** Free items given by schemes (free_item, or buy_x_get_y on a different SKU). */
  free_items: z
    .array(
      z.object({
        scheme_id: uuid,
        product_link_id: uuid,
        sku_link_id: uuid.nullable().optional(),
        product_name: z.string(),
        sku_label: z.string().nullable().optional(),
        quantity: z.number().positive(),
      }),
    )
    .default([]),
  /** Sum of quantity × unit_price, before discounts. */
  subtotal: money,
  /** Line discounts plus order-level discounts. */
  discount_total: money,
  /** What the customer pays for the items (before delivery). */
  total: money,
});

/** Customer (PosCustomer). */
export const erpCustomerSchema = z.object({
  link_id: uuid,
  code: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  is_active: z.boolean(),
});

export const erpOrderLineSchema = z.object({
  product_link_id: uuid.optional(),
  /** Null for a product without sizes/variants. */
  sku_link_id: uuid.nullable().optional(),
  product_name: z.string(),
  sku_label: z.string().nullable().optional(),
  quantity: money,
  unit_price: money,
  discount: money,
  line_total: money,
});

/** Online order, created through POST /orders (BUN-164). */
export const erpOrderSchema = z.object({
  link_id: uuid,
  number: z.string(),
  status: z.enum([
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "dispatched",
    "completed",
    "cancelled",
  ]),
  placed_at: isoDateTime,
  /** NEW (BUN-165): when the status last changed. */
  status_changed_at: isoDateTime.nullable().optional(),
  currency: z.string().length(3),
  customer_link_id: uuid.nullable(),
  lines: z.array(erpOrderLineSchema),
  subtotal: money,
  discount_total: money,
  delivery_fee: money,
  total: money,
});

/** Laravel's standard error body: { message, errors? }. */
export const erpErrorBodySchema = z.object({
  message: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

/** List responses are wrapped: { data: [...] } (Laravel API resources). */
export const listOf = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item) });
/** Single-item responses are wrapped: { data: {...} }. */
export const one = <T extends z.ZodType>(item: T) => z.object({ data: item });

export type ErpPrice = z.infer<typeof erpPriceSchema>;
export type ErpCategory = z.infer<typeof erpCategorySchema>;
export type ErpSku = z.infer<typeof erpSkuSchema>;
export type ErpProduct = z.infer<typeof erpProductSchema>;
export type ErpBanner = z.infer<typeof erpBannerSchema>;
export type ErpScheme = z.infer<typeof erpSchemeSchema>;
export type ErpQuote = z.infer<typeof erpQuoteSchema>;
export type ErpCustomer = z.infer<typeof erpCustomerSchema>;
export type ErpOrder = z.infer<typeof erpOrderSchema>;
export type ErpOrderLine = z.infer<typeof erpOrderLineSchema>;
