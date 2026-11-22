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

type Discountable = {
  compareAtPrice?: number;
  offers?: { startsAt?: string; endsAt?: string }[];
  skus?: { compareAtPrice?: number }[];
};

/**
 * A crossed-out price and "Save X%" are only shown while an ERP scheme
 * applies to the product (BUN-170). If the ERP sends a compare-at price but
 * no current scheme covers the product, the compare-at price is dropped (on
 * the product and its sizes), so the card shows a plain price.
 */
export function withSchemeBackedDiscounts<T extends Discountable>(
  product: T,
  now: number = Date.now(),
): T {
  if ((product.offers ?? []).some((o) => isWithinWindow(o, now))) return product;
  if (product.compareAtPrice === undefined && !product.skus?.some((s) => s.compareAtPrice)) {
    return product;
  }
  return {
    ...product,
    compareAtPrice: undefined,
    ...(product.skus && {
      skus: product.skus.map((s) => ({ ...s, compareAtPrice: undefined })),
    }),
  };
}

const STORE_TIME_ZONE = "Asia/Colombo";

const calendarDay = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE }).format(date);

/**
 * When an offer ends, in Sri Lanka time (BUN-174): "Ends today at 6:00 pm",
 * "Ends tomorrow at 9:00 am", or "Valid until Sat 28 Nov". Null for an
 * offer without an end date. With `now` null (cached HTML, before the
 * browser knows the time), always the date form.
 */
export function offerValidity(
  offer: { endsAt?: string },
  now: number | null = Date.now(),
): string | null {
  if (!offer.endsAt) return null;
  const ends = new Date(offer.endsAt);
  const today = now === null ? null : calendarDay(new Date(now));
  const tomorrow = now === null ? null : calendarDay(new Date(now + 86_400_000));
  const time = new Intl.DateTimeFormat("en-LK", {
    timeZone: STORE_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(ends)
    .toLowerCase();
  if (calendarDay(ends) === today) return `Ends today at ${time}`;
  if (calendarDay(ends) === tomorrow) return `Ends tomorrow at ${time}`;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: STORE_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(ends);
  return `Valid until ${date}`;
}

/**
 * The next moment an offer starts or ends (ms), or null. Cached product data
 * is refreshed by then, so a price lowered by a scheme goes back up on time
 * (BUN-174).
 */
export function nextOfferChange(
  schemes: { startsAt?: string; endsAt?: string }[],
  now: number = Date.now(),
): number | null {
  const times = schemes
    .flatMap((s) => [s.startsAt, s.endsAt])
    .filter((t): t is string => Boolean(t))
    .map((t) => Date.parse(t))
    .filter((t) => Number.isFinite(t) && t > now);
  return times.length > 0 ? Math.min(...times) : null;
}

/**
 * The price to show right now (BUN-174). A crossed-out price comes from a
 * scheme (see withSchemeBackedDiscounts). If every scheme on the product has
 * ended since the page was cached, the ERP no longer gives that discount, so
 * the original price is the price again, without a crossed-out price.
 */
export function priceNow<P extends { price: number; compareAtPrice?: number }>(
  shown: P,
  offers: { startsAt?: string; endsAt?: string }[] | undefined,
  now: number = Date.now(),
): P {
  if (shown.compareAtPrice === undefined || !offers || offers.length === 0) return shown;
  if (offers.some((o) => isWithinWindow(o, now))) return shown;
  return { ...shown, price: shown.compareAtPrice, compareAtPrice: undefined };
}

/**
 * What the price block shows (BUN-174): the ERP price, corrected for an
 * offer that has ended (`now`, null before the browser knows the time), and
 * the signed-in customer's own price when they have a different one ("Your
 * price"; the usual price is then crossed out if it's higher).
 */
export function displayPrice(
  shown: { price: number; compareAtPrice?: number },
  {
    offers,
    now,
    personal,
  }: {
    offers?: { startsAt?: string; endsAt?: string }[];
    now: number | null;
    personal?: number;
  },
): { price: number; compareAtPrice?: number; yourPrice: boolean } {
  const current = now === null ? shown : priceNow(shown, offers, now);
  if (personal === undefined || personal === current.price) return { ...current, yourPrice: false };
  return {
    price: personal,
    compareAtPrice: personal < current.price ? current.price : undefined,
    yourPrice: true,
  };
}

/**
 * The customer's price from GET /api/prices for a product: the chosen size's
 * price, or (no size chosen, as on cards) the lowest size price, or the
 * product price.
 */
export function personalPriceFor(
  entry: { price: number; skus: Record<string, number> } | undefined,
  skuId?: string,
): number | undefined {
  if (!entry) return undefined;
  if (skuId) return entry.skus[skuId];
  const sizes = Object.values(entry.skus);
  return sizes.length > 0 ? Math.min(...sizes) : entry.price;
}
