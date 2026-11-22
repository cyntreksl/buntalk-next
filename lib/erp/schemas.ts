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

export const erpCategorySchema = z.object({
  link_id: uuid,
  /** NEW: URL slug, unique per tenant. */
  slug: z.string().min(1),
  name: z.string(),
  /** NEW */
  description: z.string().nullable().optional(),
  /** NEW: absolute image URL. */
  image_url: z.url().nullable().optional(),
  is_active: z.boolean(),
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
  /** NEW: absolute image URLs, first is the main image. */
  image_urls: z.array(z.url()).default([]),
  is_active: z.boolean(),
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
  image_url: z.url().nullable().optional(),
  image_alt: z.string().nullable().optional(),
});

/** Scheme / offer (PosOccasionOffer, PosGroupDiscount). Applied by the ERP scheme engine (BUN-163). */
export const erpSchemeSchema = z.object({
  link_id: uuid,
  name: z.string(),
  kind: z.enum(["percent", "amount", "free_item", "fixed_price"]),
  reward_value: money,
  min_spend: money.nullable(),
  starts_at: isoDateTime.nullable(),
  ends_at: isoDateTime.nullable(),
  /** Product link_ids the scheme applies to; empty = all products. */
  product_ids: z.array(uuid).default([]),
  /** Category link_ids the scheme applies to. */
  category_ids: z.array(uuid).default([]),
  is_active: z.boolean(),
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
  sku_link_id: uuid,
  product_name: z.string(),
  sku_label: z.string().nullable().optional(),
  quantity: money,
  unit_price: money,
  discount: money,
  line_total: money,
});

/** Online order (to be created through the order API, BUN-164). */
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
export type ErpCustomer = z.infer<typeof erpCustomerSchema>;
export type ErpOrder = z.infer<typeof erpOrderSchema>;
export type ErpOrderLine = z.infer<typeof erpOrderLineSchema>;
