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
  getActiveSchemes,
  getCategories,
  getCategory,
  getFeaturedProducts,
  getHomeBanners,
  getNavigationCategories,
  getOfferProducts,
  getProduct,
  getProductsForCart,
  getProductsByCategory,
  searchProducts,
} from "./catalog";

// Live basket pricing by the ERP scheme engine (never cached)
export { quoteCart, type Quote, type QuoteLineInput } from "./quote";

// Order writes (BUN-164): idempotent, never retried by the HTTP client
export {
  createOrder,
  getOrder,
  matchOrCreateCustomer,
  type ErpOrderInput,
  type ErpOrderLineInput,
} from "./orders";

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
  ProductOffer,
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
