import "server-only";
import type { Category, Product } from "./catalog";

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
];

export const sampleProducts: Product[] = [
  {
    slug: "sample-product-1",
    name: "Sample Product 1",
    description: "Placeholder product used until the ERP is connected.",
    price: 450,
    currency: "LKR",
    categorySlug: "sample-category-a",
    featured: true,
  },
  {
    slug: "sample-product-2",
    name: "Sample Product 2",
    description: "Placeholder product used until the ERP is connected.",
    price: 1200,
    currency: "LKR",
    categorySlug: "sample-category-a",
    featured: false,
  },
  {
    slug: "sample-product-3",
    name: "Sample Product 3",
    description: "Placeholder product used until the ERP is connected.",
    price: 780,
    currency: "LKR",
    categorySlug: "sample-category-b",
    featured: true,
  },
];
