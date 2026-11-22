import type { Product, ProductOffer, Scheme } from "@/lib/erp";
import { formatPrice } from "@/lib/utils";

/**
 * Offer helpers (pure, usable on the server and in the browser).
 *
 * The storefront never applies a scheme or calculates a discount: the ERP
 * does that (POST /prices/quote, see lib/cart.server.ts). These helpers only
 * decide which offers to *show* on a product, and how to word them.
 */

/** Short badge text: "10% off", "LKR 200 off", "Buy 2 get 1 free". */
export function schemeLabel(scheme: Scheme, currency = "LKR"): string {
  const value = scheme.rewardValue;
  switch (scheme.kind) {
    case "percent":
      return value ? `${trimNumber(value)}% off` : "Offer";
    case "amount":
      return value ? `${formatPrice(value, currency).replace(/\.00$/, "")} off` : "Offer";
    case "fixed_price":
      return value ? `Now ${formatPrice(value, currency).replace(/\.00$/, "")}` : "Offer";
    case "buy_x_get_y":
      return scheme.buyQuantity && scheme.getQuantity
        ? `Buy ${scheme.buyQuantity} get ${scheme.getQuantity} free`
        : "Multi-buy offer";
    case "free_item":
      return "Free gift";
  }
}

const trimNumber = (n: number) => String(Number(n.toFixed(2)));

/** True when `now` is inside the scheme's start/end window (open ends count as inside). */
export function isWithinWindow(
  window: { startsAt?: string; endsAt?: string },
  now: number = Date.now(),
): boolean {
  const starts = window.startsAt ? Date.parse(window.startsAt) : -Infinity;
  const ends = window.endsAt ? Date.parse(window.endsAt) : Infinity;
  return starts <= now && now < ends;
}

/** A category id and all its parents' ids. */
function withAncestors(
  categoryId: string | undefined,
  parents: Map<string, string | undefined>,
): Set<string> {
  const ids = new Set<string>();
  let current = categoryId;
  while (current && !ids.has(current)) {
    ids.add(current);
    current = parents.get(current);
  }
  return ids;
}

/**
 * The offers to show on a product: schemes that name the product, or its
 * category or one of its parent categories. Whole-order schemes ("LKR 500 off
 * orders over …") aren't product offers and are left out.
 */
export function offersFor(
  product: Pick<Product, "id" | "categoryId" | "currency">,
  schemes: Scheme[],
  categories: { id: string; parentId?: string }[],
): ProductOffer[] {
  const parents = new Map(categories.map((c) => [c.id, c.parentId]));
  const categoryIds = withAncestors(product.categoryId, parents);
  return schemes
    .filter(
      (s) =>
        !s.wholeOrder &&
        ((product.id !== undefined && s.productIds.includes(product.id)) ||
          s.categoryIds.some((id) => categoryIds.has(id))),
    )
    .map((s) => ({
      schemeId: s.id,
      label: schemeLabel(s, product.currency),
      name: s.name,
      description: s.description,
      minSpend: s.minSpend,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
    }));
}
