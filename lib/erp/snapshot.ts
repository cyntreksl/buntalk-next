import "server-only";
import { erpGet } from "./http";
import {
  erpBannerSchema,
  erpCategorySchema,
  erpProductSchema,
  erpSchemeSchema,
  listOf,
  type ErpBanner,
  type ErpCategory,
  type ErpProduct,
  type ErpScheme,
} from "./schemas";

/**
 * The whole catalog as the ERP has it right now (live, never cached),
 * hidden items included. Used by the scheduled catalog check (BUN-167) to
 * spot changes a missed webhook didn't report.
 *
 * TODO(BUN-255): read only what changed (`?updated_since=`) once the ERP
 * offers a change feed, instead of the full lists.
 */
export type CatalogSnapshot = {
  categories: ErpCategory[];
  products: ErpProduct[];
  schemes: ErpScheme[];
  banners: ErpBanner[];
};

export async function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  const [categories, products, schemes, banners] = await Promise.all([
    erpGet("/categories", listOf(erpCategorySchema)),
    erpGet("/products", listOf(erpProductSchema)),
    erpGet("/schemes", listOf(erpSchemeSchema)),
    erpGet("/banners", listOf(erpBannerSchema), { placement: "home" }),
  ]);
  return {
    categories: categories.data,
    products: products.data,
    schemes: schemes.data,
    banners: banners.data,
  };
}
