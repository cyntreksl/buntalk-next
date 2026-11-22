import type { Product } from "@/lib/erp";
import { buildFacets, parseFilters, type CategoryChoice } from "@/lib/filters";
import { parseListingParams, DEFAULT_SORT } from "@/lib/listing";
import { FilterPanel } from "./FilterPanel";

/**
 * Filter sidebar for a product listing (BUN-173). Server component: reads the
 * filters from the URL and works out the options that exist in the current
 * results. Render it inside <Suspense> (it reads the URL), in the listing's
 * sidebar; ProductListing applies the same filters to the grid.
 */
export async function ProductFilters({
  products,
  searchParams,
  basePath,
  keep = [],
  categoryChoices = [],
}: {
  products: Product[];
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  basePath: string;
  /** Other query parameters to keep, e.g. [["q", "bun"]]. */
  keep?: [string, string][];
  /** Categories to offer as a filter (for example the sub-categories). */
  categoryChoices?: CategoryChoice[];
}) {
  if (products.length === 0) return null;
  const params = await searchParams;
  const state = parseFilters(params, products, categoryChoices);
  const facets = buildFacets(products, state, categoryChoices);
  const { sort } = parseListingParams(params);
  const kept: [string, string][] = [
    ...keep,
    ...(sort !== DEFAULT_SORT ? [["sort", sort] as [string, string]] : []),
  ];

  return (
    <FilterPanel
      facets={facets}
      state={state}
      basePath={basePath}
      keep={kept}
      currency={products[0].currency}
    />
  );
}
