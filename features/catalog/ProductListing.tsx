import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Pagination } from "@/components/ui";
import type { Product } from "@/lib/erp";
import {
  DEFAULT_SORT,
  PAGE_SIZE,
  availableSorts,
  paginate,
  parseListingParams,
  sortProducts,
} from "@/lib/listing";
import { ProductGrid } from "./ProductCard";
import { SortSelect } from "./SortSelect";

/**
 * A sortable, paginated product grid (BUN-169), shared by category pages and
 * search results.
 *
 * Server-rendered: it reads ?sort= and ?page= from the URL, sorts and cuts
 * the (cached) product list on the server, and renders real links for the
 * pages, so every view is shareable, back-button safe and crawlable. Render it
 * inside <Suspense> (it reads the URL), with ProductGridSkeleton as the
 * fallback. A page number past the end is a 404.
 */
export async function ProductListing({
  products,
  searchParams,
  basePath,
  keep = {},
  empty,
}: {
  products: Product[];
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  /** The page's path, e.g. /category/buns. */
  basePath: string;
  /** Other query parameters to keep in sort and page links, e.g. { q: "bun" }. */
  keep?: Record<string, string>;
  /** Shown when there are no products at all. */
  empty?: ReactNode;
}) {
  const { sort: requested, page } = parseListingParams(await searchParams);
  if (products.length === 0) return <ProductGrid products={[]} empty={empty} />;

  const options = availableSorts(products);
  // A sort that isn't available for these products (e.g. "newest" without dates) falls back.
  const sort = options.includes(requested) ? requested : DEFAULT_SORT;
  const paged = paginate(sortProducts(products, sort), page, PAGE_SIZE);
  if (paged.outOfRange) notFound();

  const query = { ...keep, ...(sort !== DEFAULT_SORT ? { sort } : {}) };

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <p className="text-body-sm text-muted-foreground" role="status">
          {paged.totalPages > 1
            ? `Showing ${paged.from}–${paged.to} of ${paged.total} products`
            : `${paged.total} product${paged.total === 1 ? "" : "s"}`}
        </p>
        <SortSelect action={basePath} value={sort} options={options} keep={keep} />
      </div>
      <ProductGrid products={paged.items} />
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
