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
| Webhooks    | Every ERP → storefront webhook is **signed**: `X-Erp-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">` with the shared `ERP_WEBHOOK_SECRET`. Older than 5 minutes = refused. Catalog changes: `POST /api/revalidate` (see "Catalog change webhook"); order status: see "Order status".  |

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

| Method | Path                                                | Purpose                                                             | Storefront function / ticket                  |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------- |
| GET    | `/categories`                                       | All active categories, every level, in display order (`sort_order`) | ✅ `getCategories()`                          |
| GET    | `/categories/{slug}`                                | One category                                                        | ✅ `getCategory()`                            |
| GET    | `/products?category={slug}&include_subcategories=1` | Products in a category and its sub-categories                       | ✅ `getProductsByCategory()`                  |
| GET    | `/products?featured=1`                              | Featured products (home page)                                       | ✅ `getFeaturedProducts()`                    |
| GET    | `/products?on_offer=1`                              | Products with a scheme price now                                    | ✅ `getOfferProducts()`                       |
| GET    | `/products`                                         | Every product (search and the scheduled catalog check)              | ✅ `getAllProducts()`, `getCatalogSnapshot()` |
| GET    | `/products/{slug}`                                  | One product with SKUs and resolved prices                           | ✅ `getProduct()`                             |
| GET    | `/products/{slug}?customer={link_id}`               | Same, priced for that customer (group price level). Live calls only | ✅ `getProductsForCart()` → BUN-247           |
| GET    | `/banners?placement=home`                           | Home page banners, in order                                         | ✅ `getHomeBanners()`                         |
| GET    | `/schemes`                                          | Active schemes / offers                                             | BUN-163                                       |
| POST   | `/prices/quote`                                     | Price a basket (SKUs, quantities, customer) with schemes applied    | BUN-163 / BUN-174                             |
| GET    | `/outlets`                                          | Active sales outlets (outlet locator)                               | Footer / outlet page                          |
| POST   | `/customers`                                        | Create or match a customer (`PosCustomer`)                          | BUN-186                                       |
| GET    | `/customers/{link_id}`                              | Customer profile                                                    | BUN-186                                       |
| POST   | `/orders`                                           | Place an order (`Idempotency-Key` required)                         | BUN-164                                       |
| GET    | `/orders/{link_id}`                                 | Order with lines and status                                         | Account → Orders                              |
| GET    | `/customers/{link_id}/orders`                       | A customer's orders                                                 | Account → Orders                              |

Rules for catalog endpoints:

- Send each item's `is_active` and `visible_online` flags. Hidden items may be included: the storefront filters them (BUN-161), and it needs hidden parent categories to hide their sub-categories.
- Prices are **resolved by the ERP** (`ResolveProductPrice`) for the online channel, with schemes applied, so the storefront never calculates prices itself.
- Each SKU (size/variant) carries its own resolved `price`. The cart charges the chosen SKU's price, or the product price for a product without SKUs.
- With `customer={link_id}`, prices are that customer's own (customer group → price level → `PosPriceLevelPrice`), falling back to the online price. The storefront only sends `customer` on live per-customer calls (cart, checkout, and "Your price" on cards and product pages through `/api/prices`), never for cached pages (BUN-162, BUN-174, BUN-247). For a grid of products it currently makes one call per product; accepting `customer` on `GET /products?slugs=a,b,c` would make that one call.
- **Search (BUN-172)** runs on the storefront over the full `GET /products` list (cached), so it can be typo-tolerant and answer suggestions instantly. The ERP doesn't need a `search` parameter. If the catalog grows to several thousand products, `GET /products` should support paging (`?page=`, `per_page`) so the list can be read in parts.

## 4. Entities

Field names match the zod schemas in `lib/erp/schemas.ts`. Items marked **NEW** don't exist in the ERP
tables today.

### Category (`EndProductCategory`)

| Field            | Type         | Notes                                                                                                                |
| ---------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `link_id`        | uuid         |                                                                                                                      |
| `slug`           | string       | **NEW**. URL name, unique per tenant                                                                                 |
| `name`           | string       |                                                                                                                      |
| `description`    | string, null | **NEW**                                                                                                              |
| `image_url`      | url, null    | **NEW**. Absolute URL                                                                                                |
| `banner_url`     | url, null    | **NEW** (BUN-168, ticket BUN-238). Wide banner for the category page (about 2400×600). Falls back to `image_url`     |
| `parent_link_id` | uuid, null   | **NEW** (BUN-160). Parent category; null = top level. Today categories are flat                                      |
| `sort_order`     | integer      | **NEW** (BUN-160). Display order, lower first. The storefront shows categories in exactly this order                 |
| `is_active`      | boolean      |                                                                                                                      |
| `visible_online` | boolean      | **NEW** (BUN-161). "Show on the website". Missing = visible. Hiding a category hides its sub-categories and products |

### Product (`EndProduct`)

| Field                                                       | Type                      | Notes                                                                                                                                                 |
| ----------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `link_id`, `code`                                           | uuid, string              |                                                                                                                                                       |
| `slug`                                                      | string                    | **NEW**. URL name, unique per tenant                                                                                                                  |
| `name`                                                      | string                    |                                                                                                                                                       |
| `description`                                               | string, null              | The full description ("Product details")                                                                                                              |
| `short_description`                                         | string, null              | **NEW** (BUN-171, ticket BUN-257). One or two lines next to the price. Until then, the first lines of `description` are shown there                   |
| `net_weight_grams`                                          | number, null              | **NEW** (BUN-257). From `gram_weight`                                                                                                                 |
| `servings`                                                  | integer, null             | **NEW** (BUN-257). "Serves 8"                                                                                                                         |
| `category`                                                  | `{ link_id, slug, name }` |                                                                                                                                                       |
| `image_url`                                                 | url, null                 | The product photo (`EndProduct::imageUrl()`, as in the staff `EndProductResource`). Missing or invalid = placeholder image                            |
| `gallery_urls`                                              | url[]                     | **NEW**. Extra photos                                                                                                                                 |
| `attributes`                                                | `{ name, values[] }[]`    | The product option types and values (`end_product_option_types`, `product_option_values`). Each one is a filter (Size, Flavour) on listings (BUN-173) |
| `tags`                                                      | `{ group, value }[]`      | **NEW** (BUN-173, ticket BUN-258). Filter tags, e.g. `{ group: "Occasion", value: "Birthday" }`. Only active tags in groups shown on the website      |
| `processing_time_hours`                                     | number, null              | **NEW** (BUN-160). Preparation time shown as "Ready in …". `production_schedule` (days made) is not the same thing                                    |
| `min_order_quantity`, `max_order_quantity`, `quantity_step` | integer, null             | **NEW** (BUN-175, ticket BUN-259). Online quantity limits per order line. The storefront also caps every line at 99                                   |
| `is_active`, `is_customisable`, `allows_fractional`         | boolean                   | `is_customisable`: Cake Studio product; the card shows "Customize" instead of "Add to cart" (BUN-170)                                                 |
| `visible_online`                                            | boolean                   | **NEW** (BUN-161). "Show on the website". Missing = visible. `is_active: false` always hides                                                          |
| `is_featured`                                               | boolean                   | **NEW**. Home page "Featured"                                                                                                                         |
| `popularity`                                                | number, null              | **NEW** (BUN-169, ticket BUN-256). Recent sales (e.g. units sold in the last 30 days); powers "Most popular"                                          |
| `created_at`                                                | ISO datetime, null        | **NEW** (BUN-169, ticket BUN-256). When first published; powers "Newest"                                                                              |
| `price`                                                     | Price                     | Product default price                                                                                                                                 |
| `skus`                                                      | Sku[]                     |                                                                                                                                                       |

### Sku (`EndProductSku`)

| Field                                                       | Type                      | Notes                                                                                           |
| ----------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------- |
| `link_id`, `code`, `barcode`                                | uuid, string, string/null |                                                                                                 |
| `options`                                                   | `{ type, value }[]`       | From the SKU's option values (`combination_key`)                                                |
| `base_quantity`                                             | decimal string            |                                                                                                 |
| `is_active`                                                 | boolean                   |                                                                                                 |
| `visible_online`                                            | boolean                   | **NEW** (BUN-161). Hide one size/variant online                                                 |
| `in_stock`                                                  | boolean                   | **NEW**. Can it be ordered online now?                                                          |
| `min_order_quantity`, `max_order_quantity`, `quantity_step` | integer, null             | **NEW** (BUN-175, ticket BUN-259). Online quantity limits for this size; override the product's |
| `image_url`                                                 | url, null                 | **NEW** (BUN-171, ticket BUN-257). Photo of this size; shown first when it's picked             |
| `net_weight_grams`                                          | number, null              | **NEW** (BUN-257). From the option values with `scaling = net_weight`                           |
| `servings`                                                  | integer, null             | **NEW** (BUN-257). People this size serves                                                      |
| `price`                                                     | Price                     |                                                                                                 |

### Price (`ProductPriceVersion` values)

| Field              | Type                 | Notes                                                                                                   |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------- |
| `currency`         | string (3)           | Tenant `currency_code`                                                                                  |
| `selling_price`    | decimal string       | What the customer pays, with schemes applied                                                            |
| `printed_price`    | decimal string, null | Price printed on the pack (MRP)                                                                         |
| `compare_at_price` | decimal string, null | **NEW**. Price before a scheme lowered it; shown crossed out only while that scheme is active (BUN-170) |
| `tax_mode`         | string, null         |                                                                                                         |

### Banner (closest: `PosDisplaySlide`)

`link_id`, `title`, `subtitle`, `cta_label`, `href` (storefront path or URL), `image_url`, `image_alt`. **All NEW** as a storefront concept.

### Scheme (BUN-163; ERP engine: BUN-248)

The ERP has no general promotions engine yet (only occasion offers, group discounts and restaurant offers). BUN-248 adds one. Shape of `GET /schemes`:

| Field                          | Type                                                                   | Notes                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `link_id`, `name`              | uuid, string                                                           |                                                                                               |
| `description`                  | string, null                                                           | Short customer-facing text, e.g. "Buy 2 fish buns, get 1 free"                                |
| `kind`                         | `percent` \| `amount` \| `fixed_price` \| `buy_x_get_y` \| `free_item` |                                                                                               |
| `reward_value`                 | decimal string, null                                                   | Percent, amount off or fixed price                                                            |
| `buy_quantity`, `get_quantity` | integer, null                                                          | `buy_x_get_y`                                                                                 |
| `free_sku_id`                  | uuid, null                                                             | `free_item`                                                                                   |
| `min_spend`                    | decimal string, null                                                   |                                                                                               |
| `starts_at`, `ends_at`         | ISO datetime, null                                                     | The storefront hides offers outside this window; the ERP must never apply them                |
| `product_ids`, `category_ids`  | uuid[]                                                                 | Category targets include sub-categories. Both empty = whole-order scheme                      |
| `audience`                     | `everyone` \| `customer_groups`                                        | Customer-only schemes are never shown publicly; the quote applies them for eligible customers |
| `is_active`                    | boolean                                                                |                                                                                               |

The list may include inactive or ended schemes; the storefront filters them. Only schemes for the online channel should be returned.

### Quote (`POST /prices/quote`, BUN-163)

The ERP scheme engine's evaluation of a basket. Read-only (the storefront retries it like a GET). Request:

```json
{
  "customer_link_id": null,
  "lines": [{ "product_link_id": "…", "sku_link_id": "…", "quantity": 3 }]
}
```

Response `data`:

| Field             | Notes                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `currency`        |                                                                                                                                 |
| `lines[]`         | Same order as the request: `product_link_id`, `sku_link_id`, `quantity`, `unit_price`, `discount`, `line_total`, `scheme_ids[]` |
| `applied_schemes` | `[{ scheme_id, name, description, discount }]`: every scheme applied, with its total saving (line and order level)              |
| `free_items`      | `[{ scheme_id, product_link_id, sku_link_id, product_name, sku_label, quantity }]`                                              |
| `subtotal`        | Before discounts                                                                                                                |
| `discount_total`  | Line plus order-level discounts                                                                                                 |
| `total`           | `subtotal − discount_total` (before delivery)                                                                                   |

The same evaluation must be used when the order is placed (BUN-244), so the cart and the order always match.

### Cake Studio (BUN-179; ERP side: BUN-260)

The ERP already has Cake Studio for its own page (`DescribeCakeStudioMenu`, `NormaliseCakeDesign`, `PriceCakeDesign`, `DescribeCakeDesign`). These storefront endpoints expose the same actions (ticket BUN-260):

| Method | Path                                    | Purpose                                                                                                     | Storefront function                               |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| GET    | `/cake-studio/menu[?customer=]`         | The menu as `DescribeCakeStudioMenu` returns it (B2B prices with `customer`)                                | `getCakeStudioMenu()` (cached, tag `cake-studio`) |
| POST   | `/cake-studio/quote`                    | `{ design, customer? }` → checked design, price lines, total, summary, earliest date. 422 with field errors | `quoteCakeDesign()` (live)                        |
| POST   | `/cake-studio/designs`                  | Save a design (Idempotency-Key) → 201 with `id` (uuid) and the quote                                        | `saveCakeDesign()`                                |
| GET    | `/cake-studio/designs/{id}[?customer=]` | A saved design, **priced again now**. 404 unknown; 422 if an option was removed                             | `getCakeDesign()` (live)                          |

- **Menu** (`data`): `sizes[]` (`id`, `name`, `weight_kg`, `tiers[{width,height}]`, `serves_min`, `serves_max`, `shape_prices{shapeId: price}`, `earliest` date), `shapes[]` (`id`, `name`, `model`), `options{kind: [...]}` for the kinds `sponge`, `filling`, `frosting`, `finish`, `drip`, `topping`, `writing_colour`, `lettering`, `extra` (`id`, `code`, `name`, `price`, `colour`, `layer_colours`, `max_count`, `needs_drip`, `style`), `occasions[]` (`id`, `name`, `messages[]`), `favourites[]` (`id`, `name`, `occasion_ids`, `config`), `rules` (`is_open`, `message_max`, `photo_max_kb`, `deck_prices`, `deck_height_min_cm`, `deck_height_max_cm`, `height_cm_price`, `welcome`). Money is a decimal string.
- **Design** (the picks, as `CakeDesignRequest`): `size_id`, `tier_count`, `deck_heights[]`, `shape_id`, `sponge_id`, `filling_id`, `frosting_id`, `finish_id`, `drip_id`, `topping_ids[]`, `candle_count`, `extras[]` (codes), `topper_number`, `message`, `lettering_id`, `writing_colour_id`, `occasion_id`.
- **Quote** (`data`): `design` (normalised), `lines[{label, price}]`, `total`, `summary[{label, value}]`, `earliest_date`. Saved designs add `id` and `created_at`.
- **Prices:** the storefront never calculates a cake price; every price it shows comes from `quote` or a saved design (priced again on load).
- **3D:** the 3D preview is drawn from this data, as the ERP's `cake-scene.tsx` does: shape `model`, size `tiers`, option `colour` / `layer_colours` / `style`, `needs_drip`. There are no 3D asset files; if model files are added later, add an `asset_url` per option.
- **Changes:** when the Cake Studio setup changes, the ERP calls the revalidate webhook with `{ "type": "cake_studio" }`.

### Orders (BUN-164; ERP side: BUN-244)

The storefront saves every order first, then sends it with two idempotent writes. Each write's `Idempotency-Key` is derived from the order, and the same key is used on every retry.

1. `POST /customers`: `{ name, phone, email, source: "storefront" }`. Match by phone (then email), or create. Returns the Customer. Skipped when the shopper is signed in and their `link_id` is known.
2. `POST /orders`:

```json
{
  "storefront_order_id": "uuid",
  "storefront_order_number": "BT-261122-7K3QX",
  "customer_link_id": "…",
  "channel": "online",
  "fulfilment": {
    "type": "delivery",
    "address": { "line1": "…", "line2": null, "city": "…", "notes": null },
    "date": "2026-11-23",
    "slot": "10:00-12:00"
  },
  "lines": [
    {
      "product_link_id": "…",
      "sku_link_id": null,
      "quantity": 3,
      "unit_price": "120.00",
      "discount": "120.00",
      "line_total": "240.00",
      "scheme_ids": ["…"]
    }
  ],
  "applied_scheme_ids": ["…"],
  "currency": "LKR",
  "subtotal": "360.00",
  "discount_total": "120.00",
  "delivery_fee": "0.00",
  "total": "240.00",
  "payment": { "method": "cash_on_delivery", "status": "pending" },
  "note": null
}
```

For pickup, `fulfilment` is `{ "type": "pickup", "outlet_link_id": "…", "date": …, "slot": … }`.

| ERP answer                 | Storefront                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| 201 / 200 + Order          | Stores the ERP `link_id` and `number`. A repeated key must return the same order, never a new one        |
| 409                        | ERP total differs after re-pricing, or the slot is full: marked **rejected**, team alerted (not retried) |
| 422                        | Invalid data: **rejected**, team alerted                                                                 |
| 401/403, 429, 5xx, timeout | Temporary: **failed**, retried with the same key (1, 2, 4 … minutes, up to 8 attempts)                   |

Delivery fees, areas and slots don't exist in the ERP yet (BUN-251), so the storefront sends `delivery_fee: "0.00"`. Cake Studio cakes as order lines need BUN-252.

### Catalog change webhook (BUN-167; ERP side: BUN-246)

When catalog data changes, the ERP sends a signed `POST {STOREFRONT_URL}/api/revalidate`:

| Body                                                         | When                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `{ "type": "product", "slug": "…", "previous_slug": "…"? }`  | Product name, description, image, price version, visibility, featured, category, SKUs or options |
| `{ "type": "category", "slug": "…", "previous_slug": "…"? }` | Category name, parent, order, image, visibility                                                  |
| `{ "type": "home" }`                                         | Featured list                                                                                    |
| `{ "type": "banners" }`                                      | Home banners                                                                                     |
| `{ "type": "schemes" }`                                      | Any scheme added, changed or ended                                                               |
| `{ "type": "cake_studio" }`                                  | Cake Studio menu, prices or rules changed (BUN-179)                                              |
| `{ "type": "all" }`                                          | Bulk imports, price-list changes                                                                 |
| `{ "events": [ … ] }`                                        | Several of the above at once (up to 200), e.g. a burst collapsed by the job                      |

Answers: `200` (safe to retry), `401` (bad or old signature: check the secret and clock), `400` (invalid body). The storefront also checks the whole catalog every 5 minutes, so a lost webhook delays a change by at most 5 minutes. A change feed (`?updated_since=`, BUN-255) would let that check read only what changed.

### Order status (BUN-165; ERP side: BUN-253)

Statuses: `pending` → `confirmed` → `preparing` → `ready` → `dispatched` (delivery only) → `completed`, or `cancelled`. The order resource includes `status_changed_at`.

**Webhook (preferred, instant).** On every status change, the ERP calls:

```
POST {STOREFRONT_URL}/api/webhooks/erp/order-status
X-Erp-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with the shared ERP_WEBHOOK_SECRET>

{ "event": "order.status_changed",
  "data": { "link_id": "…", "number": "WEB-1001", "storefront_order_number": "BT-261122-7K3QX",
            "status": "preparing", "changed_at": "2026-11-22T10:15:00Z" } }
```

| Storefront answer | Meaning                                                                               |
| ----------------- | ------------------------------------------------------------------------------------- |
| 200 `{ applied }` | Accepted. `applied: false` means an older or repeated update, which is ignored        |
| 202               | Not a storefront order (for example a POS order); nothing to do                       |
| 401               | Bad signature, or a timestamp more than 5 minutes off. Check the secret and the clock |

Deliveries may be retried or arrive out of order: the storefront keeps the newest `changed_at`.

**Polling (fallback).** The storefront also reads `GET /orders/{link_id}` for open orders every 5 minutes, and when a customer views an order whose status is over a minute old.

### Customer (`PosCustomer`; BUN-166, ERP side: BUN-243 and BUN-254)

`link_id`, `code`, `name`, `phone` (E.164 `+94…`), `email`, `is_active`, plus the **NEW** fields:

- `merged_into_link_id`: set when staff merged this customer into another one;
- `addresses[]`: `label`, `line1`, `line2`, `city`, `notes`, `is_default`.

| Call                  | Purpose                                                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /customers`     | Match by phone (normalised), then email, or create. Never returns a merged-away customer. `Idempotency-Key` required                                         |
| `PUT /customers/{id}` | Replace `name`, `phone`, `email` and `addresses[]` (`Idempotency-Key`). **409** if the phone/email belongs to another customer; **404** if merged or unknown |
| `GET /customers/{id}` | Read one                                                                                                                                                     |

The storefront links each storefront customer to exactly one ERP customer, and sends the full profile after every change. On 404 it links again by phone. On 409 it stops and alerts the team.

### Order (`PosOrder` and `PosOrderLine`, online type)

| Field                                                 | Type                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `link_id`, `number`                                   | uuid, string                                                                                     |
| `status`                                              | `pending` \| `confirmed` \| `preparing` \| `ready` \| `dispatched` \| `completed` \| `cancelled` |
| `placed_at`                                           | ISO datetime                                                                                     |
| `currency`, `customer_link_id`                        | string, uuid/null                                                                                |
| `lines[]`                                             | `sku_link_id`, `product_name`, `sku_label`, `quantity`, `unit_price`, `discount`, `line_total`   |
| `subtotal`, `discount_total`, `delivery_fee`, `total` | decimal strings                                                                                  |

## 5. ERP backlog

Every ERP-side gap has a ticket under epic **BUN-232** "ERP Storefront API (ERP side)". Each ticket is linked to the storefront ticket it blocks. Add a new ticket there for any new gap.

| Ticket  | ERP work                                                                  | Blocks                    |
| ------- | ------------------------------------------------------------------------- | ------------------------- |
| BUN-233 | API foundation: routes, machine credential, error format                  | BUN-159, BUN-230          |
| BUN-234 | Catalog endpoints (categories, products, SKU `in_stock`)                  | BUN-160                   |
| BUN-235 | Slugs on products and categories                                          | BUN-160, BUN-246          |
| BUN-236 | Category parent and display order                                         | BUN-160                   |
| BUN-237 | Preparation (processing) time                                             | BUN-160                   |
| BUN-238 | Public image URLs, image host, extra photos                               | BUN-160                   |
| BUN-239 | "Show on the website" switch                                              | BUN-161                   |
| BUN-240 | Featured products and home banners                                        | BUN-157                   |
| BUN-241 | Online price channel, resolved and compare-at prices                      | BUN-162, BUN-174          |
| BUN-242 | Schemes and basket price quote                                            | BUN-163, BUN-177          |
| BUN-243 | Customer create/match and read                                            | BUN-166, 192, 195, 196    |
| BUN-244 | Online orders: model, place, status                                       | BUN-164, BUN-165, BUN-201 |
| BUN-245 | Sales outlets endpoint                                                    | BUN-201                   |
| BUN-246 | Revalidate webhook calls from the ERP                                     | BUN-167                   |
| BUN-247 | Customer-specific prices (customer group price levels)                    | BUN-162, BUN-196          |
| BUN-248 | Promotions scheme engine (shared by POS and web)                          | BUN-163, BUN-208, BUN-242 |
| BUN-250 | Ingredients, allergens and dietary tags per product                       | BUN-249                   |
| BUN-251 | Delivery areas, delivery fees and time slots                              | BUN-164, BUN-199          |
| BUN-252 | Cake Studio cakes as lines of an online order                             | BUN-164, BUN-184          |
| BUN-253 | Online order fulfilment workflow and status webhooks                      | BUN-165, BUN-194          |
| BUN-254 | Update storefront customers: profile, addresses, merges                   | BUN-166, BUN-193, BUN-198 |
| BUN-255 | Catalog change feed (`updated_since`) for the scheduled check             | BUN-167                   |
| BUN-256 | Product popularity and publish date (sorting)                             | BUN-169                   |
| BUN-257 | Product page details: short description, photo per size, weight, servings | BUN-171                   |
| BUN-258 | Product tags for filters (occasion and other tag groups)                  | BUN-173                   |
| BUN-259 | Online order quantity limits per product and size (min, max, step)        | BUN-175                   |
| BUN-260 | Cake Studio storefront API: menu, design quote, saved designs by ID       | BUN-179, BUN-180–185      |

## 6. Open questions for the ERP team

1. **Auth (BUN-233):** Passport client-credentials, or per-tenant API keys? Who issues and rotates them?
2. **Price channel (BUN-241):** online prices as the product default, or a dedicated "online" outlet / price level in `ProductPriceProfile`?
3. **Slugs (BUN-235):** add a `slug` column to categories and products, or derive slugs from `code`?
4. **Images (BUN-238):** products have one photo (`image_path` on the `central_public` disk). Which host serves it in each environment, and can products have more than one photo? The storefront needs the host for image optimisation.
5. **Category hierarchy and order (BUN-160 → BUN-236):** add `parent_id` and `sort_order` to `end_product_categories`, with a way to set them in the ERP?
6. **Processing time (BUN-160 → BUN-237):** add a preparation-time field per product (or per SKU), in hours?
7. **Online visibility (BUN-161 → BUN-239):** add a "Show on the website" switch (`visible_online`) to products, categories and SKUs? Today only `is_active` exists, so the storefront hides inactive items and treats everything active as visible. The list endpoints should keep sending hidden items (or at least hidden categories): the storefront needs hidden parents to hide their sub-categories. When it changes, the ERP should call the revalidate webhook for that product or category.
8. **Orders (BUN-244):** a new `type` on `PosOrder`, or a separate online-order model? Which outlet fulfils them?
9. **Webhook (BUN-246):** which ERP events trigger `POST /api/revalidate` (price change, product edit, banner change)?
