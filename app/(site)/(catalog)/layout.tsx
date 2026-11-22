/**
 * Catalog pages: home, all categories, category and product.
 *
 * Rendering: static + ISR. Every page here is built from cached ERP data
 * (`'use cache'` + cacheLife in lib/erp/catalog.ts) and refreshed in the
 * background when its cache lifetime passes or /api/revalidate is called.
 *
 * `ensureStatic = 'prefetch'` here: the App Shell and the per-link prefetch
 * of every catalog page must be static (build fails otherwise). Pages that
 * are entirely the same for everyone go further and set 'navigation'
 * themselves (home, all categories, product): their complete HTML is
 * prerendered, even with JavaScript disabled.
 *
 * Category pages stay at 'prefetch' (BUN-169): the header, banner and sidebar
 * are prerendered; the product grid depends on ?sort= and ?page=, so it is
 * rendered per request inside <Suspense> (from the cached ERP read) and
 * streamed in the same response, still server-rendered for search engines.
 */
export const ensureStatic = "prefetch";

export default function CatalogLayout({ children }: LayoutProps<"/">) {
  return <>{children}</>;
}
