import "server-only";
import type { ErpCategory, ErpProduct, ErpSku } from "./schemas";

/**
 * Online visibility rules: the one place that decides what the storefront may show.
 *
 * Every catalog read (lists, search, featured, offers, a single product or
 * category) and the cart's server check go through these, so a product the
 * business hides in the ERP disappears everywhere at once.
 *
 * - A category is visible when it is active, not switched off for the website
 *   (`visible_online: false`), and none of its parents are hidden.
 * - A product is visible when it is active, not switched off for the website,
 *   and its category is visible. Hiding a category hides everything in it.
 * - A SKU (size/variant) is visible when it is active and not switched off.
 *
 * `visible_online` is a new ERP field (docs/erp-api-contract.md, question 7).
 * Until the ERP sends it, `is_active` alone decides.
 */

type Switches = Pick<ErpCategory, "is_active" | "visible_online">;

const isOn = (item: Switches) => item.is_active && item.visible_online !== false;

/**
 * The link_ids of every visible category. A category whose parent is hidden is
 * hidden too. A parent that isn't in the list at all doesn't hide its children
 * (they are shown at the top level, as in buildCategoryTree).
 */
export function visibleCategoryIds(categories: ErpCategory[]): Set<string> {
  const byId = new Map(categories.map((c) => [c.link_id, c]));
  const visible = new Set<string>();

  for (const category of categories) {
    let current: ErpCategory | undefined = category;
    const seen = new Set<string>();
    let ok = true;
    // Walk up to the root; stop on loops in bad data.
    while (current && !seen.has(current.link_id)) {
      seen.add(current.link_id);
      if (!isOn(current)) {
        ok = false;
        break;
      }
      current = current.parent_link_id ? byId.get(current.parent_link_id) : undefined;
    }
    if (ok) visible.add(category.link_id);
  }
  return visible;
}

export function isProductVisible(
  product: Pick<ErpProduct, "is_active" | "visible_online" | "category">,
  categoryIds: Set<string>,
): boolean {
  return isOn(product) && categoryIds.has(product.category.link_id);
}

export function isSkuVisible(sku: Pick<ErpSku, "is_active" | "visible_online">): boolean {
  return isOn(sku);
}
