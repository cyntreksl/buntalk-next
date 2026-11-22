import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { descendantSlugs, sortByErpOrder } from "@/lib/categories";
import { isSampleCatalogEnabled } from "@/lib/env.server";
import { isOnOffer } from "@/lib/pricing";
import { ErpNotFoundError } from "./errors";
import { erpGet } from "./http";
import { toBanner, toCategory, toProduct } from "./mappers";
import { sampleBanners, sampleCategories, sampleProducts } from "./sample-catalog";
import { offersFor, withSchemeBackedDiscounts } from "@/lib/offers";
import { searchCatalog } from "@/lib/search";
import {
  erpBannerSchema,
  erpCategorySchema,
  erpProductSchema,
  erpSchemeSchema,
  listOf,
  one,
  type ErpCategory,
  type ErpProduct,
} from "./schemas";
import { toScheme } from "./mappers";
import type { Banner, Category, Product, Scheme } from "./types";
import { isProductVisible, visibleCategoryIds } from "./visibility";

export type { Banner, Category, Product } from "./types";

/**
 * Cached catalog reads.
 *
 * Every function is a `'use cache'` scope with a cacheLife profile from
 * next.config.ts and cache tags from lib/cache-tags.ts. This is what lets the
 * home, category and product pages be prerendered and refreshed (ISR).
 * Failures throw (and are not cached); the next request tries again.
 *
 * Endpoints: see docs/erp-api-contract.md. Local development without ERP
 * credentials uses lib/erp/sample-catalog.ts instead.
 */

const notFoundToNull = (error: unknown) => {
  if (error instanceof ErpNotFoundError) return null;
  throw error;
};

/**
 * Every category the ERP has, hidden ones included. Internal: the visibility
 * rules (lib/erp/visibility.ts) need hidden parents to hide their children.
 */
async function getErpCategories(): Promise<ErpCategory[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.categories);

  const { data } = await erpGet("/categories", listOf(erpCategorySchema));
  return data;
}

/**
 * Keeps only the products the storefront may show (active, visible online, in
 * a visible category), even if the ERP sends hidden ones.
 */
async function visibleProducts(products: ErpProduct[]): Promise<Product[]> {
  const [categories, schemes] = await Promise.all([getErpCategories(), getActiveSchemes()]);
  const ids = visibleCategoryIds(categories);
  const tree = categories.map((c) => ({ id: c.link_id, parentId: c.parent_link_id ?? undefined }));
  return (
    products
      .filter((p) => isProductVisible(p, ids))
      .map(toProduct)
      .map((p) => ({ ...p, offers: offersFor(p, schemes, tree) }))
      // A crossed-out price only while an ERP scheme applies (BUN-170).
      .map((p) => withSchemeBackedDiscounts(p))
  );
}

/**
 * Active schemes (offers) everyone can get, from the ERP scheme engine.
 * Inactive, ended and customer-only schemes are left out. Schemes that start
 * later are kept with their dates, so their badges appear on time in the
 * browser (OfferBadges) without waiting for a refresh.
 *
 * For showing offers only: discounts are always applied by the ERP
 * (quoteCart in lib/erp/quote.ts).
 */
export async function getActiveSchemes(): Promise<Scheme[]> {
  "use cache";
  cacheLife("schemes");
  cacheTag(cacheTags.catalog, cacheTags.schemes);

  if (isSampleCatalogEnabled()) return [];
  const { data } = await erpGet("/schemes", listOf(erpSchemeSchema));
  const now = Date.now();
  return data
    .filter((s) => s.is_active && s.audience === "everyone")
    .filter((s) => !s.ends_at || Date.parse(s.ends_at) > now)
    .map(toScheme);
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.categories);

  // All visible categories (every level), in the ERP's display order.
  if (isSampleCatalogEnabled()) return sortByErpOrder(sampleCategories);
  const all = await getErpCategories();
  const ids = visibleCategoryIds(all);
  return sortByErpOrder(all.filter((c) => ids.has(c.link_id)).map(toCategory));
}

/**
 * Categories for the header and footer navigation. Unlike getCategories(),
 * this never throws: if the ERP is down, the header and footer render without
 * category links instead of taking the whole page down with them.
 *
 * The error is caught outside the cached read, so an outage isn't cached as an
 * empty list: the next request tries the ERP again.
 */
export async function getNavigationCategories(): Promise<Category[]> {
  try {
    return await getCategories();
  } catch (error) {
    console.error("[nav] Could not load categories; showing navigation without them.", error);
    return [];
  }
}

export async function getCategory(slug: string): Promise<Category | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.categories, cacheTags.category(slug));

  if (isSampleCatalogEnabled()) return sampleCategories.find((c) => c.slug === slug) ?? null;
  const res = await erpGet(`/categories/${encodeURIComponent(slug)}`, one(erpCategorySchema)).catch(
    notFoundToNull,
  );
  if (!res) return null;
  // Hidden, or under a hidden parent: the category page is a 404.
  const ids = visibleCategoryIds(await getErpCategories());
  return ids.has(res.data.link_id) ? toCategory(res.data) : null;
}

export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(
    cacheTags.catalog,
    cacheTags.categories,
    cacheTags.products,
    cacheTags.schemes,
    cacheTags.category(categorySlug),
  );

  // Includes products in sub-categories, so a parent category page isn't empty.
  if (isSampleCatalogEnabled()) {
    const slugs = descendantSlugs(sampleCategories, categorySlug);
    return sampleProducts.filter((p) => slugs.includes(p.categorySlug));
  }
  const { data } = await erpGet("/products", listOf(erpProductSchema), {
    category: categorySlug,
    include_subcategories: 1,
  });
  return visibleProducts(data);
}

export async function getProduct(slug: string): Promise<Product | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag(
    cacheTags.catalog,
    cacheTags.categories,
    cacheTags.products,
    cacheTags.schemes,
    cacheTags.product(slug),
  );

  if (isSampleCatalogEnabled()) return sampleProducts.find((p) => p.slug === slug) ?? null;
  const res = await erpGet(`/products/${encodeURIComponent(slug)}`, one(erpProductSchema)).catch(
    notFoundToNull,
  );
  // A hidden product's page is a 404, exactly like a product that doesn't exist.
  return res ? ((await visibleProducts([res.data]))[0] ?? null) : null;
}

export async function getFeaturedProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(
    cacheTags.catalog,
    cacheTags.home,
    cacheTags.categories,
    cacheTags.products,
    cacheTags.schemes,
  );

  if (isSampleCatalogEnabled()) return sampleProducts.filter((p) => p.featured);
  const { data } = await erpGet("/products", listOf(erpProductSchema), { featured: 1 });
  return visibleProducts(data);
}

/** Home page banners, in display order (the first is the hero). */
export async function getHomeBanners(): Promise<Banner[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.home, cacheTags.banners);

  if (isSampleCatalogEnabled()) return sampleBanners;
  const { data } = await erpGet("/banners", listOf(erpBannerSchema), { placement: "home" });
  return data.map(toBanner);
}

/** Products currently on offer (priced by the ERP scheme engine, BUN-163/BUN-174). */
export async function getOfferProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(
    cacheTags.catalog,
    cacheTags.home,
    cacheTags.categories,
    cacheTags.products,
    cacheTags.schemes,
  );

  if (isSampleCatalogEnabled()) return sampleProducts.filter(isOnOffer);
  const { data } = await erpGet("/products", listOf(erpProductSchema), { on_offer: 1 });
  return (await visibleProducts(data)).filter(isOnOffer);
}

/**
 * Every product shown online (cached). Search (BUN-172) runs over this list
 * on the storefront, so it can be typo-tolerant and fast, and it only ever
 * finds visible products.
 */
export async function getAllProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.categories, cacheTags.products, cacheTags.schemes);

  if (isSampleCatalogEnabled()) return sampleProducts;
  const { data } = await erpGet("/products", listOf(erpProductSchema));
  return visibleProducts(data);
}

/** Products matching a search, best first (lib/search.ts). */
export async function searchProducts(query: string): Promise<Product[]> {
  "use cache";
  cacheLife("search");
  cacheTag(cacheTags.catalog, cacheTags.categories, cacheTags.products, cacheTags.schemes);

  if (!query.trim()) return [];
  const [products, categories] = await Promise.all([getAllProducts(), getCategories()]);
  return searchCatalog(products, query, new Map(categories.map((c) => [c.slug, c.name])));
}

/**
 * Live (uncached) read of products for the cart and checkout: always asks the
 * ERP, so a product hidden or re-priced a second ago is seen straight away,
 * even before the cached pages refresh. Returns each slug's product, or null
 * if it is hidden or gone.
 *
 * With `customerId`, the ERP resolves that customer's own prices (their
 * customer group's price level). Those prices are never cached or shown on
 * shared pages; they only reach that customer's cart.
 */
export async function getProductsForCart(
  slugs: string[],
  options: { customerId?: string } = {},
): Promise<Map<string, Product | null>> {
  const unique = [...new Set(slugs)];
  if (isSampleCatalogEnabled()) {
    return new Map(unique.map((s) => [s, sampleProducts.find((p) => p.slug === s) ?? null]));
  }
  const query = options.customerId ? { customer: options.customerId } : undefined;
  const [{ data: categories }, products] = await Promise.all([
    erpGet("/categories", listOf(erpCategorySchema)),
    Promise.all(
      unique.map((slug) =>
        erpGet(`/products/${encodeURIComponent(slug)}`, one(erpProductSchema), query)
          .then((r) => r.data)
          .catch(notFoundToNull),
      ),
    ),
  ]);
  const ids = visibleCategoryIds(categories);
  return new Map(
    unique.map((slug, i) => {
      const p = products[i];
      return [slug, p && isProductVisible(p, ids) ? toProduct(p) : null];
    }),
  );
}
