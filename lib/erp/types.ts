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
  /** Wide banner for the category page header (falls back to imageUrl, then a branded panel). */
  bannerUrl?: string;
  /** Parent category's id; undefined for a top-level category. */
  parentId?: string;
  /** ERP display order (lower first). Lists keep this order; never re-sorted by name. */
  sortOrder?: number;
};

/** A category with its sub-categories, for menus and sidebars. */
export type CategoryNode = Category & { children: CategoryNode[] };

/** A product option and all its values, e.g. { name: "Size", values: ["Small", "Large"] }. */
export type ProductAttribute = { name: string; values: string[] };

export type ProductOption = { type: string; value: string };

export type Sku = {
  id: string;
  code: string;
  options: ProductOption[];
  price: number;
  compareAtPrice?: number;
  inStock: boolean;
  /** Photo of this size; the product page shows it when the size is picked. */
  imageUrl?: string;
  netWeightGrams?: number;
  servings?: number;
};

export type Product = {
  /** ERP link_id (absent in old sample data). */
  id?: string;
  slug: string;
  name: string;
  description: string;
  /** One or two lines next to the price. Undefined until the ERP sends it (BUN-257). */
  shortDescription?: string;
  netWeightGrams?: number;
  /** "Serves 8". */
  servings?: number;
  price: number;
  /** Original price when the product is on offer (higher than `price`). */
  compareAtPrice?: number;
  /** Price printed on the pack (MRP), when the ERP sends one. */
  printedPrice?: number;
  currency: string;
  categorySlug: string;
  featured: boolean;
  /** Made to order in Cake Studio (ERP is_customisable): the card shows "Customize" instead of "Add to cart". */
  customizable?: boolean;
  /** Higher = more popular (from the ERP's sales). Undefined until the ERP sends it. */
  popularity?: number;
  /** When the product was first published (ISO). Undefined until the ERP sends it. */
  createdAt?: string;
  /** ERP product code (shown as "Item code"). */
  code?: string;
  /** Photos, main one first. Empty or missing = show the placeholder image. */
  imageUrls?: string[];
  attributes?: ProductAttribute[];
  /** Hours the bakery needs to prepare it, if the ERP sets one. */
  processingTimeHours?: number;
  skus?: Sku[];
  /** ERP category link_id. */
  categoryId?: string;
  /** Active offers (ERP schemes) on this product, for badges. Applied only by the ERP. */
  offers?: ProductOffer[];
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

/** Discount scheme / offer from the ERP scheme engine (BUN-163). The ERP applies it; the storefront only shows it. */
export type Scheme = {
  id: string;
  name: string;
  description?: string;
  kind: "percent" | "amount" | "free_item" | "fixed_price" | "buy_x_get_y";
  rewardValue?: number;
  buyQuantity?: number;
  getQuantity?: number;
  minSpend?: number;
  /** ISO date-times. A scheme outside its window is never shown (and never applied by the ERP). */
  startsAt?: string;
  endsAt?: string;
  productIds: string[];
  categoryIds: string[];
  /** Whole-order schemes (e.g. "LKR 500 off orders over LKR 10,000") have no products or categories. */
  wholeOrder: boolean;
};

/** An offer shown on a product (badge, product page). */
export type ProductOffer = {
  schemeId: string;
  /** Short badge text: "10% off", "Buy 2 get 1 free". */
  label: string;
  name: string;
  description?: string;
  minSpend?: number;
  startsAt?: string;
  endsAt?: string;
};

export type Customer = {
  id: string;
  code: string;
  name: string;
  phone?: string;
  email?: string;
  /** Set when the ERP merged this customer into another one (use that id instead). */
  mergedIntoId?: string;
};

export type OrderStatus =
  "pending" | "confirmed" | "preparing" | "ready" | "dispatched" | "completed" | "cancelled";

export type OrderLine = {
  productId?: string;
  /** Undefined for a product without sizes/variants. */
  skuId?: string;
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
  /** When the status last changed (ISO), if the ERP sends it. */
  statusChangedAt?: string;
  currency: string;
  customerId?: string;
  lines: OrderLine[];
  subtotal: number;
  discountTotal: number;
  deliveryFee: number;
  total: number;
};
