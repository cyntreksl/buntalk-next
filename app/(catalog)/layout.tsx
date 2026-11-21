/**
 * Catalog pages: home, category and product.
 *
 * Rendering: static + ISR. Every page here is built from cached ERP data
 * (`'use cache'` + cacheLife in lib/erp/catalog.ts) and refreshed in the
 * background when its cache lifetime passes or /api/revalidate is called.
 *
 * `ensureStatic = 'navigation'` makes the build fail if anything in these
 * pages reads per-request data (cookies, headers, searchParams, uncached
 * fetches). It also means a product or category that was not prerendered at
 * build time waits for its full static page on the first visit instead of
 * streaming a loading fallback, so the HTML always contains the content,
 * even with JavaScript disabled.
 */
export const ensureStatic = "navigation";

export default function CatalogLayout({ children }: LayoutProps<"/">) {
  return <>{children}</>;
}
