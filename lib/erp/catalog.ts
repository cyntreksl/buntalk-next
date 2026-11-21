import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isSampleCatalogEnabled } from "@/lib/env.server";
import { cacheTags } from "@/lib/cache-tags";
import { erpFetch, ErpError } from "./client";
import { sampleCategories, sampleProducts } from "./sample-catalog";

export type Category = {
  slug: string;
  name: string;
  description: string;
};

export type Product = {
  slug: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  categorySlug: string;
  featured: boolean;
};

/**
 * Cached catalog reads.
 *
 * Every function is a `'use cache'` scope with a cacheLife profile from
 * next.config.ts and cache tags from lib/cache-tags.ts. This is what lets the
 * home, category and product pages be prerendered and refreshed (ISR).
 *
 * TODO(BUN-159): the ERP endpoint paths below are placeholders until the ERP
 * API client is built.
 */

const notFoundToNull = (error: unknown) => {
  if (error instanceof ErpError && error.status === 404) return null;
  throw error;
};

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.categories);

  if (isSampleCatalogEnabled()) return sampleCategories;
  return erpFetch<Category[]>("catalog/categories");
}

export async function getCategory(slug: string): Promise<Category | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.categories, cacheTags.category(slug));

  if (isSampleCatalogEnabled()) return sampleCategories.find((c) => c.slug === slug) ?? null;
  return erpFetch<Category>(`catalog/categories/${encodeURIComponent(slug)}`).catch(notFoundToNull);
}

export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.products, cacheTags.category(categorySlug));

  if (isSampleCatalogEnabled())
    return sampleProducts.filter((p) => p.categorySlug === categorySlug);
  return erpFetch<Product[]>(`catalog/products?category=${encodeURIComponent(categorySlug)}`);
}

export async function getProduct(slug: string): Promise<Product | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.products, cacheTags.product(slug));

  if (isSampleCatalogEnabled()) return sampleProducts.find((p) => p.slug === slug) ?? null;
  return erpFetch<Product>(`catalog/products/${encodeURIComponent(slug)}`).catch(notFoundToNull);
}

export async function getFeaturedProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.home, cacheTags.products);

  if (isSampleCatalogEnabled()) return sampleProducts.filter((p) => p.featured);
  return erpFetch<Product[]>("catalog/products?featured=true");
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
  return erpFetch<Product[]>(`catalog/products?search=${encodeURIComponent(q)}`);
}
