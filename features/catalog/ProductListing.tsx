import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CloseIcon, EmptyState, Pagination, SearchIcon, buttonClasses } from "@/components/ui";
import type { Product } from "@/lib/erp";
import {
  activeCount,
  applyFilters,
  buildFacets,
  filterParams,
  parseFilters,
  type CategoryChoice,
  type FilterState,
} from "@/lib/filters";
import {
  DEFAULT_SORT,
  PAGE_SIZE,
  availableSorts,
  paginate,
  parseListingParams,
  sortProducts,
} from "@/lib/listing";
import { formatPrice } from "@/lib/utils";
import { ProductGrid } from "./ProductCard";
import { SortSelect } from "./SortSelect";

type Chip = { label: string; next: FilterState };

/** One chip per active filter; each removes just that filter. */
function chipsFor(
  state: FilterState,
  labels: { categories: Map<string, string>; groups: Map<string, string> },
  currency: string,
): Chip[] {
  const chips: Chip[] = [];
  for (const c of state.categories) {
    chips.push({
      label: labels.categories.get(c) ?? c,
      next: { ...state, categories: state.categories.filter((x) => x !== c) },
    });
  }
  if (state.min !== undefined || state.max !== undefined) {
    const label =
      state.min !== undefined && state.max !== undefined
        ? `${formatPrice(state.min, currency)} – ${formatPrice(state.max, currency)}`
        : state.min !== undefined
          ? `From ${formatPrice(state.min, currency)}`
          : `Up to ${formatPrice(state.max!, currency)}`;
    chips.push({ label, next: { ...state, min: undefined, max: undefined } });
  }
  if (state.offer) chips.push({ label: "On offer", next: { ...state, offer: false } });
  for (const [key, values] of Object.entries(state.groups)) {
    for (const v of values) {
      chips.push({
        label: `${labels.groups.get(key) ?? key}: ${v}`,
        next: { ...state, groups: { ...state.groups, [key]: values.filter((x) => x !== v) } },
      });
    }
  }
  return chips;
}

/**
 * A filterable, sortable, paginated product grid (BUN-169, BUN-173), shared
 * by category pages and search results.
 *
 * Server-rendered: it reads the filters, ?sort= and ?page= from the URL,
 * filters, sorts and cuts the (cached) product list on the server, and
 * renders real links, so every view is shareable, back-button safe and
 * crawlable. Render it inside <Suspense> (it reads the URL), with
 * ProductGridSkeleton as the fallback, and put <ProductFilters> with the same
 * props in the sidebar. A page number past the end is a 404.
 */
export async function ProductListing({
  products,
  searchParams,
  basePath,
  keep = [],
  categoryChoices = [],
  empty,
}: {
  products: Product[];
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  /** The page's path, e.g. /category/buns. */
  basePath: string;
  /** Other query parameters to keep in links, e.g. [["q", "bun"]]. */
  keep?: [string, string][];
  /** Categories offered as a filter (see ProductFilters). */
  categoryChoices?: CategoryChoice[];
  /** Shown when there are no products at all. */
  empty?: ReactNode;
}) {
  const params = await searchParams;
  const { sort: requested, page } = parseListingParams(params);
  if (products.length === 0) return <ProductGrid products={[]} empty={empty} />;

  const filters = parseFilters(params, products, categoryChoices);
  const filtered = applyFilters(products, filters, categoryChoices);
  const options = availableSorts(products);
  // A sort that isn't available for these products (e.g. "newest" without dates) falls back.
  const sort = options.includes(requested) ? requested : DEFAULT_SORT;
  const paged = paginate(sortProducts(filtered, sort), page, PAGE_SIZE);
  if (paged.outOfRange) notFound();

  const sortParam: [string, string][] = sort !== DEFAULT_SORT ? [["sort", sort]] : [];
  const hrefWith = (state: FilterState) => {
    const search = new URLSearchParams([...keep, ...filterParams(state), ...sortParam]).toString();
    return search ? `${basePath}?${search}` : basePath;
  };
  const query = [...keep, ...filterParams(filters), ...sortParam];

  const currency = products[0].currency;
  const facets = buildFacets(products, filters, categoryChoices);
  const chips = chipsFor(
    filters,
    {
      categories: new Map(categoryChoices.map((c) => [c.slug, c.name])),
      groups: new Map(facets.groups.map((g) => [g.key, g.label])),
    },
    currency,
  );
  const cleared: FilterState = { categories: [], offer: false, groups: {} };

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border flex flex-col gap-3 border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Announced to screen readers when it changes after a filter or sort. */}
          <p className="text-body-sm text-muted-foreground" role="status" aria-live="polite">
            {paged.totalPages > 1
              ? `Showing ${paged.from}–${paged.to} of ${paged.total} products`
              : `${paged.total} product${paged.total === 1 ? "" : "s"}`}
            {activeCount(filters) > 0 && ` (filtered from ${products.length})`}
          </p>
          <SortSelect
            action={basePath}
            value={sort}
            options={options}
            keep={[...keep, ...filterParams(filters)]}
          />
        </div>
        {chips.length > 0 && (
          <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
            {chips.map((chip) => (
              <li key={chip.label}>
                <Link
                  href={hrefWith(chip.next)}
                  scroll={false}
                  aria-label={`Remove filter: ${chip.label}`}
                  className="border-accent bg-accent-soft text-accent-soft-foreground hover:bg-accent hover:text-accent-foreground text-body-sm inline-flex items-center gap-1.5 rounded-full border py-1 pr-2 pl-3 font-semibold transition-colors"
                >
                  {chip.label}
                  <CloseIcon size={14} />
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={hrefWith(cleared)}
                scroll={false}
                className="text-body-sm text-primary px-2 font-bold underline-offset-4 hover:underline"
              >
                Clear all
              </Link>
            </li>
          </ul>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<SearchIcon size={32} />}
          title="No products match these filters"
          description={<p>Try removing a filter or widening the price range.</p>}
          actions={
            <Link
              href={hrefWith(cleared)}
              scroll={false}
              className={buttonClasses({ variant: "outline" })}
            >
              Clear all filters
            </Link>
          }
        />
      ) : (
        <ProductGrid products={paged.items} />
      )}
      <Pagination
        page={paged.page}
        totalPages={paged.totalPages}
        basePath={basePath}
        query={query}
        className="flex justify-center pt-2"
      />
    </div>
  );
}
