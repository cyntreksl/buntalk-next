import "server-only";
import { getAllProducts, type CakeStudioMenu, type Product, type SavedCakeDesign } from "@/lib/erp";

/**
 * Cake Studio designs as cart lines (BUN-184).
 *
 * A designed cake is a line of the Cake Studio product (ERP is_customisable)
 * in the size (SKU) the design's cake size is sold as (`sku_link_id` on the
 * cake size, ERP ticket BUN-261), carrying the saved design's id. Its price is
 * the design's own price from Cake Studio, priced again by the ERP every time
 * the cart is checked; the summary and picture come from the ERP too.
 */

/** The product and size a design is sold as, or null when its cake size isn't linked to one. */
export async function cakeLineFor(
  menu: Pick<CakeStudioMenu, "sizes">,
  sizeId: number,
  preferSlug?: string,
): Promise<{ productSlug: string; skuId: string } | null> {
  const skuId = menu.sizes.find((s) => s.id === sizeId)?.skuLinkId;
  if (!skuId) return null;
  const sells = (p: Product) => p.customizable && (p.skus ?? []).some((s) => s.id === skuId);
  const products = (await getAllProducts()).filter(sells);
  const product = products.find((p) => p.slug === preferSlug) ?? products[0];
  return product ? { productSlug: product.slug, skuId } : null;
}

/** "Label: value" lines for the cart, from the ERP's summary of the design (at most 10). */
export function cakeSummary(design: Pick<SavedCakeDesign, "summary">): string[] {
  return design.summary
    .map((row) => `${row.label}: ${row.value}`.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .map((line) => (line.length > 80 ? `${line.slice(0, 79)}…` : line))
    .slice(0, 10);
}

/** The picture of a design, when the cart can show it (https, or the local mock ERP). */
export function cakePreview(design: Pick<SavedCakeDesign, "previewUrl">): string | undefined {
  const url = design.previewUrl;
  return url && PREVIEW_URL.test(url) && url.length <= 500 ? url : undefined;
}

/** https, a path on this site, or (for development) the mock ERP on this machine. */
export const PREVIEW_URL = /^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/|\/(?!\/))/;
