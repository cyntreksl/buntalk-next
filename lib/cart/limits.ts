/**
 * Cart quantity limits (BUN-175). Pure, usable on the server and in the
 * browser.
 *
 * Every line is 1 to 99 (MAX_QUANTITY), the storefront's own cap. When the
 * ERP sets online limits on the product or the size (min, max, step; ERP
 * ticket BUN-259), those apply too, the size's own limits first.
 */

/** The storefront's cap per cart line. */
export const MAX_QUANTITY = 99;
/** At most this many lines in one cart. */
export const MAX_CART_LINES = 50;

export type Limits = { min: number; max: number; step: number };

type WithLimits = { minQuantity?: number; maxQuantity?: number; quantityStep?: number };

export function quantityLimits(product?: WithLimits, sku?: WithLimits): Limits {
  const step = Math.max(1, sku?.quantityStep ?? product?.quantityStep ?? 1);
  // The smallest allowed quantity is at least one step.
  const min = Math.max(1, step, sku?.minQuantity ?? product?.minQuantity ?? 1);
  const max = Math.min(MAX_QUANTITY, sku?.maxQuantity ?? product?.maxQuantity ?? MAX_QUANTITY);
  // Largest multiple of the step within the max (never below min).
  const stepMax = Math.floor(max / step) * step;
  return { min: Math.min(min, Math.max(stepMax, step)), max: Math.max(stepMax, min), step };
}

/** The nearest allowed quantity: within min–max, rounded up to a multiple of the step. */
export function clampQuantity(quantity: number, limits: Limits): number {
  const q = Number.isFinite(quantity) ? Math.round(quantity) : limits.min;
  const stepped = Math.ceil(q / limits.step) * limits.step;
  return Math.min(limits.max, Math.max(limits.min, stepped));
}

/** One cart line per product, size and Cake Studio design: "cake:sku-1kg:design-d42". */
export const lineKey = (productSlug: string, skuId?: string, designId?: string) =>
  [productSlug, skuId, designId && `design-${designId}`].filter(Boolean).join(":");
