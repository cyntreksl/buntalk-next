import "server-only";

/**
 * ERP API client layer — server only.
 *
 * Every request to the ERP goes through here so auth headers, base URL,
 * error handling and caching rules live in one place. Typed endpoint
 * modules (products, prices, stock, orders) are added in BUN-159.
 */
export { erpFetch, ErpError } from "./client";
export {
  getCategories,
  getCategory,
  getFeaturedProducts,
  getHomeBanners,
  getOfferProducts,
  getProduct,
  getProductsByCategory,
  searchProducts,
  type Banner,
  type Category,
  type Product,
} from "./catalog";
