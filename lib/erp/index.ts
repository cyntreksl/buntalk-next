import "server-only";

/**
 * ERP client layer: the only way storefront code talks to the BrandTalk ERP.
 * Server only; ERP credentials never reach the browser.
 *
 * Features import typed functions and types from "@/lib/erp". The HTTP client
 * (./http), schemas and mappers are internal: ESLint blocks importing them, or
 * the ERP settings, from anywhere outside lib/erp. See README "ERP client" and
 * docs/erp-api-contract.md.
 */

// Catalog reads (cached)
export {
  getCategories,
  getCategory,
  getFeaturedProducts,
  getHomeBanners,
  getNavigationCategories,
  getOfferProducts,
  getProduct,
  getProductsByCategory,
  searchProducts,
} from "./catalog";

// Storefront types
export type {
  Banner,
  Category,
  CategoryNode,
  Customer,
  Order,
  OrderLine,
  OrderStatus,
  Product,
  ProductAttribute,
  ProductOption,
  Scheme,
  Sku,
} from "./types";

// Error types
export {
  ErpConfigError,
  ErpConflictError,
  ErpError,
  ErpNotFoundError,
  ErpResponseError,
  ErpUnavailableError,
  ErpValidationError,
} from "./errors";
