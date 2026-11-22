# Storefront ⇄ ERP API contract (proposal)

**Status:** proposal from the storefront team for the ERP team to review (BUN-159).
**Storefront code:** `lib/erp/` (client: `http.ts`, shapes: `schemas.ts`).
**ERP code reviewed:** `buntalk-erp-v2`, models `EndProduct`, `EndProductCategory`, `EndProductSku`,
`ProductPriceVersion`, `PosOccasionOffer`, `PosGroupDiscount`, `PosCustomer`, `PosOrder`, `PosOrderLine`,
`PosDisplaySlide`, `SalesOutlet`.

The ERP's existing `/api/v1/tenants/{tenant}/…` endpoints are for staff. They need a signed-in user with
per-feature permissions, so the storefront can't use them. This proposes a small, read-mostly
**storefront API** next to them.

## 1. Basics

| Item        | Proposal                                                                                                                                                                                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base path   | `{ERP_API_BASE_URL}/v1/tenants/{ERP_TENANT}/storefront`, e.g. `https://erp.example.com/api/v1/tenants/buntalk/storefront`                                                                                                                                                                                   |
| Auth        | `Authorization: Bearer <token>`. A **machine credential just for the storefront**, not a staff user: either a Passport client-credentials token with a `storefront` scope, or a hashed API key per tenant. Read-only scope for catalog endpoints; order and customer endpoints need a separate write scope. |
| Format      | JSON, `snake_case`. Money as decimal **strings** (`"1250.00"`), with a 3-letter `currency`. Timestamps in ISO 8601 UTC. IDs are the existing `link_id` UUIDs.                                                                                                                                               |
| Envelope    | Laravel API resources: `{ "data": … }` for items and lists. Lists may add `meta`/`links` for pagination later.                                                                                                                                                                                              |
| Request ID  | The storefront sends `X-Request-Id` (UUID) on every call. Please log it, so problems can be traced on both sides.                                                                                                                                                                                           |
| Idempotency | Writes send `Idempotency-Key`. The ERP should return the original result for a repeated key (no double orders).                                                                                                                                                                                             |
| Rate limit  | Return `429` with `Retry-After` (seconds). The storefront waits and retries reads.                                                                                                                                                                                                                          |
| Webhook     | When catalog data changes, the ERP calls the storefront's `POST /api/revalidate` (see README "Rendering strategy").                                                                                                                                                                                         |

## 2. Errors

Use Laravel's normal error bodies: `{ "message": "…", "errors": { "field": ["…"] } }`.

| ERP status        | Storefront error      | What the storefront does                                              |
| ----------------- | --------------------- | --------------------------------------------------------------------- |
| 401 / 403         | `ErpConfigError`      | Logs a credentials problem and shows the friendly error page          |
| 404               | `ErpNotFoundError`    | Shows the 404 page                                                    |
| 409               | `ErpConflictError`    | Shows `message` to the customer (e.g. stock changed)                  |
| 422               | `ErpValidationError`  | Shows `message` and the field messages on the form                    |
| 429, 5xx, timeout | `ErpUnavailableError` | Retries reads twice with back-off, then shows the friendly error page |
| Unexpected shape  | `ErpResponseError`    | Logs which field didn't match and shows the friendly error page       |

Messages in `422` and `409` responses are shown to customers, so please write them for shoppers.

## 3. Endpoints

All endpoints below are **new**. ✅ = already used by the storefront (with sample data locally).

| Method | Path                          | Purpose                                                          | Storefront function / ticket |
| ------ | ----------------------------- | ---------------------------------------------------------------- | ---------------------------- |
| GET    | `/categories`                 | Active categories, in display order                              | ✅ `getCategories()`         |
| GET    | `/categories/{slug}`          | One category                                                     | ✅ `getCategory()`           |
| GET    | `/products?category={slug}`   | Products in a category                                           | ✅ `getProductsByCategory()` |
| GET    | `/products?featured=1`        | Featured products (home page)                                    | ✅ `getFeaturedProducts()`   |
| GET    | `/products?on_offer=1`        | Products with a scheme price now                                 | ✅ `getOfferProducts()`      |
| GET    | `/products?search={q}`        | Name / code / description search                                 | ✅ `searchProducts()`        |
| GET    | `/products/{slug}`            | One product with SKUs and resolved prices                        | ✅ `getProduct()`            |
| GET    | `/banners?placement=home`     | Home page banners, in order                                      | ✅ `getHomeBanners()`        |
| GET    | `/schemes`                    | Active schemes / offers                                          | BUN-163                      |
| POST   | `/prices/quote`               | Price a basket (SKUs, quantities, customer) with schemes applied | BUN-163 / BUN-174            |
| GET    | `/outlets`                    | Active sales outlets (outlet locator)                            | Footer / outlet page         |
| POST   | `/customers`                  | Create or match a customer (`PosCustomer`)                       | BUN-186                      |
| GET    | `/customers/{link_id}`        | Customer profile                                                 | BUN-186                      |
| POST   | `/orders`                     | Place an order (`Idempotency-Key` required)                      | BUN-164                      |
| GET    | `/orders/{link_id}`           | Order with lines and status                                      | Account → Orders             |
| GET    | `/customers/{link_id}/orders` | A customer's orders                                              | Account → Orders             |

Rules for catalog endpoints:

- Return only active categories, products and SKUs, and only what is sold online.
- Prices are **resolved by the ERP** (`ResolveProductPrice`) for the online channel, with schemes applied, so the storefront never calculates prices itself.

## 4. Entities

Field names match the zod schemas in `lib/erp/schemas.ts`. Items marked **NEW** don't exist in the ERP
tables today.

### Category (`EndProductCategory`)

| Field         | Type         | Notes                                |
| ------------- | ------------ | ------------------------------------ |
| `link_id`     | uuid         |                                      |
| `slug`        | string       | **NEW**. URL name, unique per tenant |
| `name`        | string       |                                      |
| `description` | string, null | **NEW**                              |
| `image_url`   | url, null    | **NEW**. Absolute URL                |
| `is_active`   | boolean      |                                      |

### Product (`EndProduct`)

| Field                                               | Type                      | Notes                                |
| --------------------------------------------------- | ------------------------- | ------------------------------------ |
| `link_id`, `code`                                   | uuid, string              |                                      |
| `slug`                                              | string                    | **NEW**. URL name, unique per tenant |
| `name`                                              | string                    |                                      |
| `description`                                       | string, null              |                                      |
| `category`                                          | `{ link_id, slug, name }` |                                      |
| `image_urls`                                        | url[]                     | **NEW**. First is the main image     |
| `is_active`, `is_customisable`, `allows_fractional` | boolean                   |                                      |
| `is_featured`                                       | boolean                   | **NEW**. Home page "Featured"        |
| `price`                                             | Price                     | Product default price                |
| `skus`                                              | Sku[]                     |                                      |

### Sku (`EndProductSku`)

| Field                        | Type                      | Notes                                            |
| ---------------------------- | ------------------------- | ------------------------------------------------ |
| `link_id`, `code`, `barcode` | uuid, string, string/null |                                                  |
| `options`                    | `{ type, value }[]`       | From the SKU's option values (`combination_key`) |
| `base_quantity`              | decimal string            |                                                  |
| `is_active`                  | boolean                   |                                                  |
| `in_stock`                   | boolean                   | **NEW**. Can it be ordered online now?           |
| `price`                      | Price                     |                                                  |

### Price (`ProductPriceVersion` values)

| Field              | Type                 | Notes                                                        |
| ------------------ | -------------------- | ------------------------------------------------------------ |
| `currency`         | string (3)           | Tenant `currency_code`                                       |
| `selling_price`    | decimal string       | What the customer pays, with schemes applied                 |
| `printed_price`    | decimal string, null | Price printed on the pack (MRP)                              |
| `compare_at_price` | decimal string, null | **NEW**. Price before a scheme lowered it; shown crossed out |
| `tax_mode`         | string, null         |                                                              |

### Banner (closest: `PosDisplaySlide`)

`link_id`, `title`, `subtitle`, `cta_label`, `href` (storefront path or URL), `image_url`, `image_alt`. **All NEW** as a storefront concept.

### Scheme (`PosOccasionOffer`, `PosGroupDiscount`)

`link_id`, `name`, `kind` (`percent` | `amount` | `free_item` | `fixed_price`), `reward_value`,
`min_spend`, `starts_at`, `ends_at`, `product_ids`, `category_ids`, `is_active`.

### Customer (`PosCustomer`)

`link_id`, `code`, `name`, `phone`, `email`, `is_active`.

### Order (`PosOrder` and `PosOrderLine`, online type)

| Field                                                 | Type                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `link_id`, `number`                                   | uuid, string                                                                                     |
| `status`                                              | `pending` \| `confirmed` \| `preparing` \| `ready` \| `dispatched` \| `completed` \| `cancelled` |
| `placed_at`                                           | ISO datetime                                                                                     |
| `currency`, `customer_link_id`                        | string, uuid/null                                                                                |
| `lines[]`                                             | `sku_link_id`, `product_name`, `sku_label`, `quantity`, `unit_price`, `discount`, `line_total`   |
| `subtotal`, `discount_total`, `delivery_fee`, `total` | decimal strings                                                                                  |

## 5. Open questions for the ERP team

1. **Auth:** Passport client-credentials, or per-tenant API keys? Who issues and rotates them?
2. **Price channel:** online prices as the product default, or a dedicated "online" outlet / price level in `ProductPriceProfile`?
3. **Slugs:** add a `slug` column to categories and products, or derive slugs from `code`?
4. **Images:** where are product and category images stored, and which host serves them? The storefront needs the host for image optimisation.
5. **Online visibility:** a flag for "sold online" per product or SKU?
6. **Orders:** a new `type` on `PosOrder`, or a separate online-order model? Which outlet fulfils them?
7. **Webhook:** which ERP events trigger `POST /api/revalidate` (price change, product edit, banner change)?
