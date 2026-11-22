import type { Product } from "@/lib/erp";
import { listingPrice } from "@/lib/pricing";

/**
 * Sorting and pagination for product listings (BUN-169). Pure: usable on the
 * server and in tests. The listing reads `?sort=` and `?page=` from the URL,
 * so every view is shareable, back-button safe and crawlable.
 */

export const PAGE_SIZE = 24;

export const SORTS = {
  recommended: "Recommended",
  popular: "Most popular",
  newest: "Newest",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
} as const;

export type SortKey = keyof typeof SORTS;
export const DEFAULT_SORT: SortKey = "recommended";

/**
 * The sorts that make sense for these products. "Most popular" and "Newest"
 * need data the ERP doesn't send yet (BUN-256), so they only appear once
 * some product has it.
 */
export function availableSorts(products: Product[]): SortKey[] {
  return (Object.keys(SORTS) as SortKey[]).filter((key) => {
    if (key === "popular") return products.some((p) => p.popularity !== undefined);
    if (key === "newest") return products.some((p) => p.createdAt !== undefined);
    return true;
  });
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Reads ?sort= and ?page= safely: unknown sorts and bad page numbers fall back to the defaults. */
export function parseListingParams(params: RawParams): { sort: SortKey; page: number } {
  const sortParam = first(params.sort);
  const sort = sortParam && sortParam in SORTS ? (sortParam as SortKey) : DEFAULT_SORT;
  const pageNumber = Number(first(params.page));
  const page = Number.isInteger(pageNumber) && pageNumber >= 1 ? pageNumber : 1;
  return { sort, page };
}

/** Undefined values go last, whatever the direction. */
function compareOptional(a: number | undefined, b: number | undefined, direction: 1 | -1) {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return (a - b) * direction;
}

/**
 * Sorts a copy of the list. Ties keep the ERP's order (stable sort), so
 * equal prices never shuffle between visits.
 *
 * - recommended: featured products first, then the ERP's order.
 * - price: the price customers see on the card (the lowest size price).
 */
export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const list = products.map((product, index) => ({ product, index }));
  const by = (cmp: (a: Product, b: Product) => number) =>
    list.sort((a, b) => cmp(a.product, b.product) || a.index - b.index).map((x) => x.product);

  switch (sort) {
    case "recommended":
      return by((a, b) => Number(b.featured) - Number(a.featured));
    case "popular":
      return by((a, b) => compareOptional(a.popularity, b.popularity, -1));
    case "newest":
      return by((a, b) =>
        compareOptional(
          a.createdAt ? Date.parse(a.createdAt) : undefined,
          b.createdAt ? Date.parse(b.createdAt) : undefined,
          -1,
        ),
      );
    case "price-asc":
      return by((a, b) => listingPrice(a).price - listingPrice(b).price);
    case "price-desc":
      return by((a, b) => listingPrice(b).price - listingPrice(a).price);
  }
}

export type Paged<T> = {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
  /** 1-based positions of the first and last item shown ("Showing 25–48 of 57"). */
  from: number;
  to: number;
  /** True when the requested page is past the end (the page should 404). */
  outOfRange: boolean;
};

export function paginate<T>(items: T[], page: number, size: number = PAGE_SIZE): Paged<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const outOfRange = page > totalPages;
  const current = Math.min(page, totalPages);
  const start = (current - 1) * size;
  const slice = items.slice(start, start + size);
  return {
    items: slice,
    page: current,
    totalPages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
    outOfRange,
  };
}
