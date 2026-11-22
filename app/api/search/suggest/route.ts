import { getAllProducts, getCategories } from "@/lib/erp";
import { listingPrice } from "@/lib/pricing";
import { searchCatalog, searchCategories, type SearchSuggestions } from "@/lib/search";

const MAX_PRODUCTS = 6;
const MAX_CATEGORIES = 4;

/**
 * Type-ahead suggestions for the search box (BUN-172).
 *
 *   GET /api/search/suggest?q=choc
 *   200 { query, products: [{ slug, name, price, from, currency, imageUrl }], categories: [{ slug, name }] }
 *
 * Searches the cached list of visible products and categories (no ERP call
 * per keystroke), so it answers in a few milliseconds and never suggests a
 * hidden product. Browsers and CDNs may keep an answer for a minute.
 */
export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  const empty: SearchSuggestions = { query, products: [], categories: [] };
  if (query.length < 2) return Response.json(empty);

  const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);
  const names = new Map(categories.map((c) => [c.slug, c.name]));
  const body: SearchSuggestions = {
    query,
    products: searchCatalog(products, query, names)
      .slice(0, MAX_PRODUCTS)
      .map((p) => {
        const shown = listingPrice(p);
        return {
          slug: p.slug,
          name: p.name,
          price: shown.price,
          from: shown.from,
          currency: p.currency,
          imageUrl: p.imageUrls?.[0],
        };
      }),
    categories: searchCategories(categories, query)
      .slice(0, MAX_CATEGORIES)
      .map((c) => ({ slug: c.slug, name: c.name })),
  };
  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
