import "server-only";
import type { Banner, Category, Product } from "./types";

/**
 * Sample data used only for local development when ERP credentials are not
 * set (see isSampleCatalogEnabled in lib/env.server.ts). Never used on staging or production.
 */
export const sampleCategories: Category[] = [
  {
    slug: "sample-category-a",
    name: "Sample Category A",
    description: "Placeholder category for local development.",
  },
  {
    slug: "sample-category-b",
    name: "Sample Category B",
    description: "Another placeholder category for local development.",
  },
  {
    slug: "sample-category-c",
    name: "Sample Category C",
    description: "A third placeholder category for local development.",
  },
];

const product = (
  n: number,
  categorySlug: string,
  price: number,
  extra: Partial<Product> = {},
): Product => ({
  slug: `sample-product-${n}`,
  name: `Sample Product ${n}`,
  description: "Placeholder product used until the ERP is connected.",
  price,
  currency: "LKR",
  categorySlug,
  featured: false,
  ...extra,
});

export const sampleProducts: Product[] = [
  product(1, "sample-category-a", 450, { featured: true }),
  product(2, "sample-category-a", 1200, { compareAtPrice: 1500 }),
  product(3, "sample-category-b", 780, { featured: true }),
  product(4, "sample-category-b", 320, { featured: true, compareAtPrice: 400 }),
  product(5, "sample-category-c", 2650, { featured: true }),
  product(6, "sample-category-c", 990, { compareAtPrice: 1100 }),
];

export const sampleBanners: Banner[] = [
  {
    id: "sample-hero",
    title: "Sample hero banner",
    subtitle: "Placeholder promotion from the sample catalog. Real banners come from the ERP.",
    ctaLabel: "Shop the sample range",
    href: "/category/sample-category-a",
  },
  {
    id: "sample-promo",
    title: "Sample promotion",
    subtitle: "A second placeholder banner.",
    ctaLabel: "See offers",
    href: "/#offers",
  },
];
