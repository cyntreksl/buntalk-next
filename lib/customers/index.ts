import "server-only";

/**
 * Storefront customers and their ERP link (BUN-166). See README "Customers".
 */
export {
  CustomerError,
  deleteAddress,
  findCustomerByPhone,
  getCustomer,
  listAddresses,
  registerCustomer,
  saveAddress,
  updateProfile,
  type AddressInput,
} from "./service";
export {
  MAX_SYNC_ATTEMPTS,
  listCustomerSyncProblems,
  retryCustomerSync,
  syncCustomer,
  type CustomerSyncResult,
} from "./sync";
export { formatPhone, normalizeEmail, normalizePhone } from "./phone";
