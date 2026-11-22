/**
 * Storefront types: what pages and features work with. camelCase, numbers
 * for money. Built from the ERP's wire types by lib/erp/mappers.ts, so ERP
 * field names never leak into components.
 *
 * These types are safe to pass to Client Components (plain data, no secrets).
 */

export type Category = {
  /** ERP link_id. */
  id?: string;
  slug: string;
  name: string;
  description: string;
  /** Absolute image URL from the ERP. Optional: a branded tile is shown without it. */
  imageUrl?: string;
};

export type ProductOption = { type: string; value: string };

export type Sku = {
  id: string;
  code: string;
  options: ProductOption[];
  price: number;
  compareAtPrice?: number;
  inStock: boolean;
};

export type Product = {
  /** ERP link_id (absent in old sample data). */
  id?: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  /** Original price when the product is on offer (higher than `price`). */
  compareAtPrice?: number;
  /** Price printed on the pack (MRP), when the ERP sends one. */
  printedPrice?: number;
  currency: string;
  categorySlug: string;
  featured: boolean;
  imageUrls?: string[];
  skus?: Sku[];
};

/** Home page promotional banner. Managed in the ERP. */
export type Banner = {
  id: string;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  /** Internal path ("/category/buns") or absolute URL. */
  href: string;
  /** Absolute image URL from the ERP. Optional: a branded background is shown without it. */
  imageUrl?: string;
  /** Short text for the image, read by screen readers. Required when imageUrl is set. */
  imageAlt?: string;
};

/** Discount scheme / offer. Applied by the ERP scheme engine (BUN-163). */
export type Scheme = {
  id: string;
  name: string;
  kind: "percent" | "amount" | "free_item" | "fixed_price";
  rewardValue: number;
  minSpend?: number;
  startsAt?: string;
  endsAt?: string;
  productIds: string[];
  categoryIds: string[];
};

export type Customer = {
  id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
};

export type OrderStatus =
  "pending" | "confirmed" | "preparing" | "ready" | "dispatched" | "completed" | "cancelled";

export type OrderLine = {
  skuId: string;
  productName: string;
  skuLabel?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
};

export type Order = {
  id: string;
  number: string;
  status: OrderStatus;
  placedAt: string;
  currency: string;
  customerId?: string;
  lines: OrderLine[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
};
