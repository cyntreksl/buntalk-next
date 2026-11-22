/**
 * Product filters for listings and search (BUN-173). Pure functions, used on
 * the server; the URL is the only state, so every filtered view can be
 * shared, bookmarked and reloaded.
 *
 * URL format (all optional, combinable):
 *   ?cat=birthday-cakes&cat=wedding-cakes   category (any of them, sub-categories included)
 *   &min=1000&max=5000                      price range (the "from" price)
 *   &offer=1                                on offer now (an ERP scheme applies)
 *   &size=1+kg&size=2+kg&flavour=Chocolate  product options and ERP tags (any value within one
 *                                           group, every group must match)
 * Option and tag groups use the group name as the key ("Size" → size).
 */

import { listingPrice } from "@/lib/pricing";

type Params = Record<string, string | string[] | undefined>;

/** Query keys that aren't option/tag groups. */
const RESERVED = new Set(["q", "sort", "page", "cat", "min", "max", "offer"]);

export type FilterState = {
  categories: string[];
  min?: number;
  max?: number;
  offer: boolean;
  /** Group key → chosen values, e.g. { size: ["1 kg"] }. */
  groups: Record<string, string[]>;
};

export type Filterable = {
  slug: string;
  categorySlug: string;
  price: number;
  compareAtPrice?: number;
  skus?: { price: number; compareAtPrice?: number; options: { type: string; value: string }[] }[];
  offers?: unknown[];
  attributes?: { name: string; values: string[] }[];
  tags?: { group: string; value: string }[];
};

/** A category the customer can filter by, with the slugs it covers (itself and its sub-categories). */
export type CategoryChoice = { slug: string; name: string; slugs: string[] };

/** "Cake Size" → "cake-size". */
export function groupKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : v === undefined ? [] : [v]).map((s) => s.trim()).filter(Boolean);

const amount = (v: string | string[] | undefined) => {
  const raw = (Array.isArray(v) ? v[0] : v)?.trim();
  if (!raw) return undefined; // "min=" from an empty price box
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** The option/tag groups a product has: key → { label, values }. */
export function productGroups(p: Filterable): Map<string, { label: string; values: string[] }> {
  const groups = new Map<string, { label: string; values: string[] }>();
  const add = (label: string, value: string) => {
    const key = groupKey(label);
    if (!key || RESERVED.has(key) || !value) return;
    const g = groups.get(key) ?? { label, values: [] };
    if (!g.values.includes(value)) g.values.push(value);
    groups.set(key, g);
  };
  for (const a of p.attributes ?? []) for (const v of a.values) add(a.name, v);
  for (const t of p.tags ?? []) add(t.group, t.value);
  return groups;
}

/** On offer now: an ERP scheme applies (BUN-163, BUN-170). */
export const isOnOfferNow = (p: Filterable) =>
  (p.offers?.length ?? 0) > 0 || listingPrice(p).compareAtPrice !== undefined;

/**
 * Reads the filters from the URL. Group keys that no product has (for
 * example tracking parameters like utm_source) are ignored, and so are
 * categories that aren't offered.
 */
export function parseFilters(
  params: Params,
  products: Filterable[],
  categoryChoices: CategoryChoice[] = [],
): FilterState {
  const known = new Set(products.flatMap((p) => [...productGroups(p).keys()]));
  const offered = new Set(categoryChoices.map((c) => c.slug));
  const groups: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(params)) {
    if (RESERVED.has(key) || !known.has(key)) continue;
    const values = list(value);
    if (values.length > 0) groups[key] = [...new Set(values)];
  }
  let min = amount(params.min);
  let max = amount(params.max);
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  return {
    categories: [...new Set(list(params.cat))].filter((s) => offered.has(s)),
    min,
    max,
    offer: list(params.offer).includes("1"),
    groups,
  };
}

type Part = "cat" | "price" | "offer" | `group:${string}`;

/** Does the product pass every filter except `skip` (used to count each filter's options)? */
function passes(
  p: Filterable,
  state: FilterState,
  choices: CategoryChoice[],
  skip?: Part,
): boolean {
  if (skip !== "cat" && state.categories.length > 0) {
    const slugs = new Set(
      choices.filter((c) => state.categories.includes(c.slug)).flatMap((c) => c.slugs),
    );
    if (!slugs.has(p.categorySlug)) return false;
  }
  if (skip !== "price") {
    const price = listingPrice(p).price;
    if (state.min !== undefined && price < state.min) return false;
    if (state.max !== undefined && price > state.max) return false;
  }
  if (skip !== "offer" && state.offer && !isOnOfferNow(p)) return false;
  const groups = productGroups(p);
  for (const [key, wanted] of Object.entries(state.groups)) {
    if (skip === `group:${key}`) continue;
    const has = groups.get(key)?.values ?? [];
    if (!wanted.some((v) => has.includes(v))) return false;
  }
  return true;
}

export function applyFilters<P extends Filterable>(
  products: P[],
  state: FilterState,
  choices: CategoryChoice[] = [],
): P[] {
  return products.filter((p) => passes(p, state, choices));
}

export type FilterOption = { value: string; label: string; count: number; selected: boolean };

export type Facets = {
  categories: FilterOption[];
  price: { min: number; max: number } | null;
  offer: { count: number; selected: boolean };
  groups: { key: string; label: string; options: FilterOption[] }[];
};

/**
 * The options to show for each filter, with how many products each would
 * give. Each filter's counts apply all the *other* filters, so ticking a
 * second size adds products instead of emptying the list. Only options that
 * exist in those results are listed (plus any already ticked, so they can be
 * unticked).
 */
export function buildFacets(
  products: Filterable[],
  state: FilterState,
  choices: CategoryChoice[] = [],
): Facets {
  const except = (part: Part) => products.filter((p) => passes(p, state, choices, part));

  const forCat = except("cat");
  const categories = choices
    .map((c) => ({
      value: c.slug,
      label: c.name,
      count: forCat.filter((p) => c.slugs.includes(p.categorySlug)).length,
      selected: state.categories.includes(c.slug),
    }))
    .filter((o) => o.count > 0 || o.selected);

  const prices = except("price").map((p) => listingPrice(p).price);
  const price = prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null;

  const offer = { count: except("offer").filter(isOnOfferNow).length, selected: state.offer };

  // Groups in the order products first mention them; values in first-seen (ERP) order.
  const labels = new Map<string, string>();
  for (const p of products)
    for (const [k, g] of productGroups(p)) if (!labels.has(k)) labels.set(k, g.label);
  const groups = [...labels].map(([key, label]) => {
    const pool = except(`group:${key}`);
    const counts = new Map<string, number>();
    for (const p of products)
      for (const v of productGroups(p).get(key)?.values ?? []) counts.set(v, 0);
    for (const p of pool)
      for (const v of productGroups(p).get(key)?.values ?? [])
        counts.set(v, (counts.get(v) ?? 0) + 1);
    const chosen = state.groups[key] ?? [];
    const options = [...counts]
      .map(([value, count]) => ({ value, label: value, count, selected: chosen.includes(value) }))
      .filter((o) => o.count > 0 || o.selected);
    return { key, label, options };
  });

  return {
    categories,
    price,
    offer,
    groups: groups.filter((g) => g.options.length > 0),
  };
}

/** How many filters are on (for the "Filters (3)" button and "Clear all"). */
export function activeCount(state: FilterState): number {
  return (
    state.categories.length +
    (state.min !== undefined || state.max !== undefined ? 1 : 0) +
    (state.offer ? 1 : 0) +
    Object.values(state.groups).reduce((n, v) => n + v.length, 0)
  );
}

/** The filters as query parameters (sort and other kept parameters are added by the caller). */
export function filterParams(state: FilterState): [string, string][] {
  return [
    ...state.categories.map((c): [string, string] => ["cat", c]),
    ...(state.min !== undefined ? [["min", String(state.min)] as [string, string]] : []),
    ...(state.max !== undefined ? [["max", String(state.max)] as [string, string]] : []),
    ...(state.offer ? [["offer", "1"] as [string, string]] : []),
    ...Object.entries(state.groups).flatMap(([k, vs]) => vs.map((v): [string, string] => [k, v])),
  ];
}
