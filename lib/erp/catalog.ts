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
import {
  erpBannerSchema,
  erpCategorySchema,
  erpProductSchema,
  listOf,
  one,
  type ErpCategory,
  type ErpProduct,
} from "./schemas";
import type { Banner, Category, Product } from "./types";
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
  const ids = visibleCategoryIds(await getErpCategories());
  return products.filter((p) => isProductVisible(p, ids)).map(toProduct);
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
  cacheTag(cacheTags.catalog, cacheTags.categories, cacheTags.products, cacheTags.product(slug));

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
  cacheTag(cacheTags.catalog, cacheTags.home, cacheTags.categories, cacheTags.products);

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
  cacheTag(cacheTags.catalog, cacheTags.home, cacheTags.categories, cacheTags.products);

  if (isSampleCatalogEnabled()) return sampleProducts.filter(isOnOffer);
  const { data } = await erpGet("/products", listOf(erpProductSchema), { on_offer: 1 });
  return (await visibleProducts(data)).filter(isOnOffer);
}

export async function searchProducts(query: string): Promise<Product[]> {
  "use cache";
  cacheLife("search");
  cacheTag(cacheTags.catalog, cacheTags.categories, cacheTags.products);

  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (isSampleCatalogEnabled()) {
    return sampleProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
  }
  const { data } = await erpGet("/products", listOf(erpProductSchema), { search: q });
  return visibleProducts(data);
}

/**
 * Live (uncached) check of products for the cart: always asks the ERP, so a
 * product hidden a second ago can't be added, even before the cached pages
 * refresh. Returns each slug's product, or null if it is hidden or gone.
 */
export async function getProductsForCart(slugs: string[]): Promise<Map<string, Product | null>> {
  const unique = [...new Set(slugs)];
  if (isSampleCatalogEnabled()) {
    return new Map(unique.map((s) => [s, sampleProducts.find((p) => p.slug === s) ?? null]));
  }
  const [{ data: categories }, products] = await Promise.all([
    erpGet("/categories", listOf(erpCategorySchema)),
    Promise.all(
      unique.map((slug) =>
        erpGet(`/products/${encodeURIComponent(slug)}`, one(erpProductSchema))
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
