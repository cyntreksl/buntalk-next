import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { isSampleCatalogEnabled } from "@/lib/env.server";
import { cacheTags } from "@/lib/cache-tags";
import { isOnOffer } from "@/lib/pricing";
import { erpFetch, ErpError } from "./client";
import { sampleBanners, sampleCategories, sampleProducts } from "./sample-catalog";

export type Category = {
  slug: string;
  name: string;
  description: string;
  /** Absolute image URL from the ERP. Optional: a branded tile is shown without it. */
  imageUrl?: string;
};

export type Product = {
  slug: string;
  name: string;
  description: string;
  price: number;
  /** Original price when the product is on offer (higher than `price`). TODO(BUN-174): ERP scheme prices. */
  compareAtPrice?: number;
  currency: string;
  categorySlug: string;
  featured: boolean;
};

/** Home page promotional banner. Managed in the ERP. */
export type Banner = {
  id: string;
  title: string;
  subtitle?: string;
  ctaLabel: string;
  /** Internal path ("/category/buns") or absolute URL. */
  href: string;
  /** Absolute image URL from the ERP. Optional: a branded background is shown without it. */
  imageUrl?: string;
  /** Short text for the image, read by screen readers. Required when imageUrl is set. */
  imageAlt?: string;
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

/**
 * Categories for the header and footer navigation. Unlike getCategories(),
 * this never throws: if the ERP is down, the header and footer render without
 * category links instead of taking the whole page down with them.
 *
 * The error is caught outside the cached read, so an outage isn't cached as an
 * empty list — the next request tries the ERP again.
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

/** Home page banners, in display order (the first is the hero). */
export async function getHomeBanners(): Promise<Banner[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.home, cacheTags.banners);

  if (isSampleCatalogEnabled()) return sampleBanners;
  return erpFetch<Banner[]>("content/banners?placement=home");
}

/** Products currently on offer. TODO(BUN-163/BUN-174): ERP scheme engine. */
export async function getOfferProducts(): Promise<Product[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.home, cacheTags.products);

  if (isSampleCatalogEnabled()) return sampleProducts.filter(isOnOffer);
  return erpFetch<Product[]>("catalog/products?on_offer=true");
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
