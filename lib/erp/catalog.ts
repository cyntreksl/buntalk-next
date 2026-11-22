import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache-tags";
import { isSampleCatalogEnabled } from "@/lib/env.server";
import { isOnOffer } from "@/lib/pricing";
import { ErpNotFoundError } from "./errors";
import { erpGet } from "./http";
import { toBanner, toCategory, toProduct } from "./mappers";
import { sampleBanners, sampleCategories, sampleProducts } from "./sample-catalog";
import { erpBannerSchema, erpCategorySchema, erpProductSchema, listOf, one } from "./schemas";
import type { Banner, Category, Product } from "./types";

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

/** Only active categories and products are shown, even if the ERP sends inactive ones. */
const active = <T extends { is_active: boolean }>(items: T[]) => items.filter((i) => i.is_active);

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.categories);

  if (isSampleCatalogEnabled()) return sampleCategories;
  const { data } = await erpGet("/categories", listOf(erpCategorySchema));
  return active(data).map(toCategory);
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
  return res && res.data.is_active ? toCategory(res.data) : null;
}

export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.products, cacheTags.category(categorySlug));

  if (isSampleCatalogEnabled()) {
    return sampleProducts.filter((p) => p.categorySlug === categorySlug);
  }
  const { data } = await erpGet("/products", listOf(erpProductSchema), { category: categorySlug });
  return active(data).map(toProduct);
}

export async function getProduct(slug: string): Promise<Product | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.products, cacheTags.product(slug));

  if (isSampleCatalogEnabled()) return sampleProducts.find((p) => p.slug === slug) ?? null;
  const res = await erpGet(`/products/${encodeURIComponent(slug)}`, one(erpProductSchema)).catch(
    notFoundToNull,
  );
  return res && res.data.is_active ? toProduct(res.data) : null;
}

export async function getFeaturedProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.home, cacheTags.products);

  if (isSampleCatalogEnabled()) return sampleProducts.filter((p) => p.featured);
  const { data } = await erpGet("/products", listOf(erpProductSchema), { featured: 1 });
  return active(data).map(toProduct);
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
  cacheTag(cacheTags.catalog, cacheTags.home, cacheTags.products);

  if (isSampleCatalogEnabled()) return sampleProducts.filter(isOnOffer);
  const { data } = await erpGet("/products", listOf(erpProductSchema), { on_offer: 1 });
  return active(data).map(toProduct).filter(isOnOffer);
}

export async function searchProducts(query: string): Promise<Product[]> {
  "use cache";
  cacheLife("search");
  cacheTag(cacheTags.catalog, cacheTags.products);

  const q = query.trim().toLowerCase();
  if (!q) return [];
  if (isSampleCatalogEnabled()) {
    return sampleProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
    );
  }
  const { data } = await erpGet("/products", listOf(erpProductSchema), { search: q });
  return active(data).map(toProduct);
}
