/**
 * Cache tags for ERP data. Cached reads attach these with `cacheTag()`, and
 * /api/revalidate expires them with `revalidateTag()` when the ERP reports a change.
 *
 * Every catalog read also carries `catalog`, so the whole catalog can be
 * refreshed at once.
 */
export const cacheTags = {
  catalog: "catalog",
  home: "home",
  banners: "banners",
  categories: "categories",
  category: (slug: string) => `category:${slug}`,
  products: "products",
  product: (slug: string) => `product:${slug}`,
  /** Active schemes / offers (product badges, offers page). */
  schemes: "schemes",
  /** Cake Studio menu and rules (BUN-179). */
  cakeStudio: "cake-studio",
} as const;
