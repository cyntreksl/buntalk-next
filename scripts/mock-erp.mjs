#!/usr/bin/env node
/**
 * Mock ERP storefront API for local development and testing.
 * Implements the catalog endpoints in docs/erp-api-contract.md with
 * in-memory data, so the storefront can run against "the ERP" before the
 * real storefront API exists.
 *
 *   npm run mock:erp            → http://127.0.0.1:4010
 *
 * Point the storefront at it (.env.local):
 *   ERP_API_BASE_URL=http://127.0.0.1:4010/api
 *   ERP_API_KEY=mock-key
 *   ERP_TENANT=buntalk
 *
 * Editing data (to test revalidation), JSON bodies:
 *   POST /__mock/products        upsert a product (matched by slug)
 *   POST /__mock/categories      upsert a category (matched by slug)
 *   POST /__mock/reset           back to the seed data
 *   GET  /__mock/state           everything
 * Static test images: GET /images/<file> (serves public/brand/*).
 *
 * Like the real ERP, the mock sends hidden items too (is_active: false,
 * visible_online: false); the storefront must filter them out (BUN-161).
 * Hide a product:  POST /__mock/products {"slug":"fish-bun","visible_online":false}
 * Change a price:  POST /__mock/products {"slug":"fish-bun","price":{"currency":"LKR","selling_price":"130.00","printed_price":null,"compare_at_price":null,"tax_mode":"inclusive"}}
 * Customer prices: GET …/products/fish-bun?customer=cust-wholesale (see PRICE_LEVELS).
 * Schemes (BUN-163): GET …/schemes, POST …/prices/quote (a small scheme engine).
 * Orders (BUN-164): POST …/customers, POST …/orders (Idempotency-Key required;
 *   a repeated key returns the first result), GET …/orders/{id}.
 *   GET /__mock/orders lists them; POST /__mock/fail {"count":2,"status":503}
 * Catalog webhooks (BUN-167): with MOCK_STOREFRONT_URL and MOCK_ERP_WEBHOOK_SECRET set,
 *   every /__mock/products|categories|schemes change sends a signed POST /api/revalidate
 *   to the storefront (add ?webhook=0 to skip it and test the scheduled catalog check).
 * Customers (BUN-166): PUT …/customers/{id} (409 if the phone/email belongs to
 *   another customer, 404 if merged), GET …/customers/{id}. GET /__mock/customers
 *   lists them; POST /__mock/customers/merge {"from","into"} merges two.
 *   POST /__mock/orders/status {"number":"WEB-1001","status":"preparing"} changes a status
 *   and sends the signed webhook (set MOCK_STOREFRONT_WEBHOOK_URL and MOCK_ERP_WEBHOOK_SECRET).
 *   makes the next 2 writes fail, to test the retry queue.
 *   Change one: POST /__mock/schemes {"link_id":"s-cake-week","is_active":false}
 */
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

const PORT = Number(process.env.MOCK_ERP_PORT ?? 4010);
const API_KEY = process.env.MOCK_ERP_KEY ?? "mock-key";
const TENANT = process.env.MOCK_ERP_TENANT ?? "buntalk";
// Order status webhooks (BUN-165): where to send them and the shared signing secret.
// MOCK_STOREFRONT_URL (e.g. http://localhost:3100) enables both webhooks: catalog
// revalidation (BUN-167) and order status (BUN-165).
const STOREFRONT_URL = (process.env.MOCK_STOREFRONT_URL ?? "").replace(/\/$/, "");
const STOREFRONT_WEBHOOK_URL =
  process.env.MOCK_STOREFRONT_WEBHOOK_URL ??
  (STOREFRONT_URL ? `${STOREFRONT_URL}/api/webhooks/erp/order-status` : "");
const WEBHOOK_SECRET = process.env.MOCK_ERP_WEBHOOK_SECRET ?? "";
const ORIGIN = `http://127.0.0.1:${PORT}`;

const price = (selling, compareAt = null) => ({
  currency: "LKR",
  selling_price: selling.toFixed(2),
  printed_price: null,
  compare_at_price: compareAt === null ? null : compareAt.toFixed(2),
  tax_mode: "inclusive",
});

const sku = (code, size, selling, extra = {}) => ({
  link_id: `sku-${code.toLowerCase()}`,
  code,
  barcode: null,
  options: [{ type: "Size", value: size }],
  base_quantity: "1.0000",
  is_active: true,
  in_stock: true,
  price: price(selling),
  ...extra,
});

/**
 * Customer group price levels (ERP: PosCustomerGroup → PosPriceLevel →
 * PosPriceLevelPrice). GET /products/{slug}?customer=<link_id> returns that
 * customer's prices. Keyed by customer link_id → product slug or SKU link_id.
 */
const PRICE_LEVELS = {
  "cust-wholesale": { "fish-bun": 100, "sku-1kg": 4000 },
};

function forCustomer(product, customer) {
  const level = PRICE_LEVELS[customer];
  if (!level) return product;
  const override = (key, p) =>
    level[key] === undefined ? p : { ...p, selling_price: level[key].toFixed(2) };
  return {
    ...product,
    price: override(product.slug, product.price),
    skus: product.skus.map((s) => ({ ...s, price: override(s.link_id, s.price) })),
  };
}

function seed() {
  // sort_order is deliberately not alphabetical.
  const categories = [
    { link_id: "c-short-eats", slug: "short-eats", name: "Short eats", sort_order: 1 },
    { link_id: "c-cakes", slug: "cakes", name: "Cakes", sort_order: 2 },
    { link_id: "c-buns", slug: "buns", name: "Buns", sort_order: 3 },
    {
      link_id: "c-birthday",
      slug: "birthday-cakes",
      name: "Birthday cakes",
      parent_link_id: "c-cakes",
      sort_order: 1,
    },
    {
      link_id: "c-wedding",
      slug: "wedding-cakes",
      name: "Wedding cakes",
      parent_link_id: "c-cakes",
      sort_order: 2,
    },
    {
      link_id: "c-hidden",
      slug: "hidden",
      name: "Inactive category",
      sort_order: 0,
      is_active: false,
    },
    {
      // Active in the ERP but switched off for the website (BUN-161).
      link_id: "c-wholesale",
      slug: "wholesale",
      name: "Wholesale only",
      sort_order: 4,
      visible_online: false,
    },
  ].map((c) => ({
    description: `${c.name} from the mock ERP.`,
    image_url: null,
    parent_link_id: null,
    is_active: true,
    ...c,
  }));

  const cat = (slug) => {
    const c = categories.find((x) => x.slug === slug);
    return { link_id: c.link_id, slug: c.slug, name: c.name };
  };
  const products = [
    {
      slug: "fish-bun",
      name: "Fish bun",
      category: cat("buns"),
      price: price(120),
      is_featured: true,
      image_url: `${ORIGIN}/images/buntalk-logo-compact.png`,
      // BUN-171: gallery photos, a short description, weight and servings.
      gallery_urls: [
        `${ORIGIN}/images/gen/Fish%20bun%20inside.svg?bg=f6c99a`,
        `${ORIGIN}/images/gen/Fish%20bun%20box.svg?bg=e9b4a0`,
        `${ORIGIN}/images/does-not-exist.jpg`,
      ],
      short_description: "Soft bun filled with spicy fish and potato, baked fresh every morning.",
      net_weight_grams: 90,
      servings: 1,
    },
    {
      slug: "sausage-bun",
      name: "Sausage bun",
      category: cat("buns"),
      price: price(150, 180),
      image_url: null,
      // BUN-175 (ERP ticket BUN-259): at most 5 per order line.
      max_order_quantity: 5,
    },
    {
      slug: "vegetable-roll",
      name: "Vegetable roll",
      category: cat("short-eats"),
      // BUN-170: a compare-at price with no scheme behind it: the card must show a plain price.
      price: price(90, 110),
      is_featured: true,
      // Points at a file that doesn't exist: the storefront must show a placeholder.
      image_url: `${ORIGIN}/images/does-not-exist.jpg`,
    },
    {
      slug: "chocolate-birthday-cake",
      name: "Chocolate birthday cake",
      category: cat("birthday-cakes"),
      price: price(4500),
      image_url: "not a valid url",
      attributes: [
        { name: "Size", values: ["1 kg", "2 kg"] },
        { name: "Flavour", values: ["Chocolate"] },
        { name: "Message", values: ["Happy Birthday", "Custom"] },
      ],
      // BUN-173 (ERP ticket BUN-258): filter tags.
      tags: [{ group: "Occasion", value: "Birthday" }],
      processing_time_hours: 48,
      // Sizes with their own prices (BUN-162). 3 kg is sold out online.
      image_url: `${ORIGIN}/images/gen/Chocolate%20cake.svg?bg=c99a7a`,
      gallery_urls: [`${ORIGIN}/images/gen/Cake%20slice.svg?bg=d9b8a0`],
      // BUN-171: each size has its own photo, weight and servings.
      skus: [
        sku("1KG", "1 kg", 4500, {
          image_url: `${ORIGIN}/images/gen/1%20kg%20cake.svg?bg=f2c6b0`,
          net_weight_grams: 1000,
          servings: 8,
        }),
        sku("2KG", "2 kg", 8500, {
          image_url: `${ORIGIN}/images/gen/2%20kg%20cake.svg?bg=b9d3c2`,
          net_weight_grams: 2000,
          servings: 16,
        }),
        sku("3KG", "3 kg", 12000, { in_stock: false }),
        sku("5KG", "5 kg", 19000, { visible_online: false }),
      ],
    },
    {
      // BUN-170: a Cake Studio product: "Customizable" badge and a "Customize" button.
      slug: "design-your-own-cake",
      name: "Design your own cake",
      category: cat("birthday-cakes"),
      price: price(5000),
      is_customisable: true,
      processing_time_hours: 72,
      attributes: [{ name: "Flavour", values: ["Chocolate", "Vanilla", "Red velvet"] }],
      tags: [
        { group: "Occasion", value: "Birthday" },
        { group: "Occasion", value: "Anniversary" },
      ],
    },
    {
      // BUN-173: a wedding cake, for size/flavour/occasion filters.
      slug: "vanilla-wedding-cake",
      name: "Vanilla wedding cake",
      category: cat("wedding-cakes"),
      price: price(15000),
      processing_time_hours: 96,
      attributes: [
        { name: "Size", values: ["2 kg", "3 kg"] },
        { name: "Flavour", values: ["Vanilla"] },
      ],
      tags: [{ group: "Occasion", value: "Wedding" }],
    },
    {
      // Switched off for the website (BUN-161): never shown, can't be added to the cart.
      slug: "staff-tea-bun",
      name: "Staff tea bun",
      category: cat("buns"),
      price: price(60),
      is_featured: true,
      visible_online: false,
    },
    {
      // Visible itself, but in a category that is hidden online.
      slug: "bulk-bun-tray",
      name: "Bulk bun tray",
      category: cat("wholesale"),
      price: price(2400),
    },
  ].map((p, i) => ({
    link_id: `p-${p.slug}`,
    code: `MK-${String(i + 1).padStart(3, "0")}`,
    description: `${p.name} from the mock ERP.`,
    is_active: true,
    is_customisable: false,
    allows_fractional: false,
    is_featured: false,
    gallery_urls: [],
    attributes: [],
    tags: [],
    processing_time_hours: null,
    skus: [],
    // BUN-169: sort data (popularity = recent units sold; created_at = when published).
    popularity: [40, 25, 60, 12, 3, 8][i] ?? 0,
    created_at: new Date(Date.UTC(2026, 9, 1 + i * 5)).toISOString(),
    ...p,
  }));
  const day = 24 * 60 * 60 * 1000;
  const at = (offsetDays) => new Date(Date.now() + offsetDays * day).toISOString();
  const scheme = (x) => ({
    description: null,
    reward_value: null,
    buy_quantity: null,
    get_quantity: null,
    free_sku_id: null,
    min_spend: null,
    starts_at: null,
    ends_at: null,
    product_ids: [],
    category_ids: [],
    audience: "everyone",
    is_active: true,
    ...x,
  });
  // BUN-163 test schemes. Like the real ERP, the list includes ones that must
  // never be shown or applied (inactive, ended, not started, customer-only).
  const schemes = [
    scheme({
      link_id: "s-bun-multibuy",
      name: "Bun bonanza",
      description: "Buy 2 fish buns, get 1 free",
      kind: "buy_x_get_y",
      buy_quantity: 2,
      get_quantity: 1,
      product_ids: ["p-fish-bun"],
      ends_at: at(7),
    }),
    scheme({
      // BUN-170: backs the sausage bun's compare-at price (LKR 180 → 150), so "Save 17%" shows.
      link_id: "s-sausage-special",
      name: "Sausage bun special",
      description: "Sausage buns for LKR 150 this week",
      kind: "fixed_price",
      reward_value: "150.00",
      product_ids: ["p-sausage-bun"],
      ends_at: at(5),
    }),
    scheme({
      link_id: "s-cake-week",
      name: "Cake week",
      description: "10% off all cakes",
      kind: "percent",
      reward_value: "10.00",
      category_ids: ["c-cakes"],
      starts_at: at(-1),
      ends_at: at(6),
    }),
    scheme({
      link_id: "s-big-order",
      name: "Big order saver",
      description: "LKR 500 off orders over LKR 10,000",
      kind: "amount",
      reward_value: "500.00",
      min_spend: "10000.00",
    }),
    scheme({
      link_id: "s-expired",
      name: "Expired bun sale",
      kind: "percent",
      reward_value: "50.00",
      category_ids: ["c-buns"],
      starts_at: at(-10),
      ends_at: at(-1),
    }),
    scheme({
      link_id: "s-inactive",
      name: "Inactive everything sale",
      kind: "percent",
      reward_value: "30.00",
      is_active: false,
    }),
    scheme({
      link_id: "s-future",
      name: "Short eats weekend",
      kind: "percent",
      reward_value: "20.00",
      category_ids: ["c-short-eats"],
      starts_at: at(2),
      ends_at: at(4),
    }),
    scheme({
      link_id: "s-wholesale-only",
      name: "Wholesale group discount",
      kind: "percent",
      reward_value: "15.00",
      category_ids: ["c-buns"],
      audience: "customer_groups",
    }),
  ];
  // Home page banners (hero slider). No images: slides use brand colours.
  const banners = [
    {
      link_id: "b-cake-week",
      title: "Cake week is here",
      subtitle: "10% off every cake, birthday cakes included.",
      cta_label: "Shop cakes",
      href: "/category/cakes",
      image_url: null,
      image_alt: null,
    },
    {
      link_id: "b-bun-bonanza",
      title: "Buy 2 fish buns, get 1 free",
      subtitle: "Fresh out of the oven every morning.",
      cta_label: "Shop buns",
      href: "/category/buns",
      image_url: null,
      image_alt: null,
    },
    {
      link_id: "b-cake-studio",
      title: "Design your own cake",
      subtitle: "Shape, flavour and decorations, in 3D.",
      cta_label: "Open Cake Studio",
      href: "/cake-studio",
      image_url: null,
      image_alt: null,
    },
  ];
  return {
    categories,
    products,
    banners,
    schemes,
    // BUN-164/166: customers (one already exists in the ERP, e.g. a walk-in
    // shop customer, to test that signing up online links instead of duplicating).
    customers: [
      {
        link_id: "cust-walkin",
        code: "C00099",
        name: "Sunil Fernando",
        phone: "+94770000099",
        email: null,
        is_active: true,
        source: "pos",
        merged_into_link_id: null,
        addresses: [],
      },
    ],
    orders: [],
    /** Idempotency-Key → stored response, so a repeated write returns the same result. */
    idempotency: {},
    /** Failure injection: the next N order/customer writes answer with this status. */
    failNext: { count: 0, status: 503 },
  };
}

/** Sends a signed webhook (lib/webhooks/signature.ts). Returns "status body" or why not. */
async function sendSigned(url, payload) {
  if (!url || !WEBHOOK_SECRET) return "not configured";
  const body = JSON.stringify(payload);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Erp-Signature": `t=${t},v1=${v1}` },
      body,
    });
    return `${res.status} ${await res.text()}`;
  } catch (error) {
    return `failed: ${error.message}`;
  }
}

/** Catalog change → signed revalidate webhook to the storefront (BUN-167). */
const sendRevalidate = (payload) =>
  sendSigned(STOREFRONT_URL ? `${STOREFRONT_URL}/api/revalidate` : "", payload);

/** Signed order status webhook to the storefront (see lib/webhooks/signature.ts). */
async function sendStatusWebhook(order) {
  if (!STOREFRONT_WEBHOOK_URL || !WEBHOOK_SECRET) return "not configured";
  const body = JSON.stringify({
    event: "order.status_changed",
    data: {
      link_id: order.link_id,
      number: order.number,
      storefront_order_number: order.storefront_order_number,
      status: order.status,
      changed_at: order.status_changed_at,
    },
  });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex");
  try {
    const res = await fetch(STOREFRONT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Erp-Signature": `t=${t},v1=${v1}` },
      body,
    });
    return `${res.status} ${await res.text()}`;
  } catch (error) {
    return `failed: ${error.message}`;
  }
}

/** POST /customers: match by phone (then email), or create. */
function createCustomer(body) {
  if (!body.name || !body.phone) {
    return { status: 422, body: { message: "Name and phone are required.", errors: {} } };
  }
  const live = state.customers.filter((c) => !c.merged_into_link_id);
  const existing =
    live.find((c) => c.phone === body.phone) ??
    (body.email ? live.find((c) => c.email === body.email) : undefined);
  if (existing) return { status: 200, body: { data: existing } };
  const n = state.customers.length + 1;
  const customer = {
    link_id: `cust-${n}`,
    code: `C${String(n).padStart(5, "0")}`,
    name: body.name,
    phone: body.phone,
    email: body.email ?? null,
    is_active: true,
    source: body.source ?? "storefront",
    merged_into_link_id: null,
    addresses: [],
  };
  state.customers.push(customer);
  return { status: 201, body: { data: customer } };
}

/** PUT /customers/{id}: replace name, phone, email and addresses (BUN-166). */
function updateCustomer(id, body) {
  const customer = state.customers.find((c) => c.link_id === id);
  if (!customer || customer.merged_into_link_id)
    return { status: 404, body: { message: "Not Found" } };
  const taken = state.customers.find(
    (c) =>
      c.link_id !== id &&
      !c.merged_into_link_id &&
      ((body.phone && c.phone === body.phone) || (body.email && c.email === body.email)),
  );
  if (taken) {
    return {
      status: 409,
      body: {
        message: `That phone number or email already belongs to ERP customer ${taken.code}.`,
      },
    };
  }
  Object.assign(customer, {
    name: body.name ?? customer.name,
    phone: body.phone ?? customer.phone,
    email: body.email ?? null,
    addresses: (body.addresses ?? []).map((a) => ({ ...a, is_default: Boolean(a.is_default) })),
  });
  return { status: 200, body: { data: customer } };
}

/** POST /orders: re-prices with the scheme engine and refuses (409) if the storefront's total differs. */
function createOrder(body) {
  if (!body.customer_link_id || !Array.isArray(body.lines) || body.lines.length === 0) {
    return { status: 422, body: { message: "Customer and lines are required.", errors: {} } };
  }
  const priced = quote({ customer_link_id: body.customer_link_id, lines: body.lines });
  if (priced.error) return { status: priced.error, body: { message: priced.message } };
  const q = priced.data;
  if (q.total !== body.total) {
    return {
      status: 409,
      body: {
        message: `Prices have changed since the order was placed (ERP total ${q.total}, storefront total ${body.total}).`,
      },
    };
  }
  const n = state.orders.length + 1;
  const order = {
    link_id: `erp-o-${n}`,
    number: `WEB-${1000 + n}`,
    status: "pending",
    placed_at: new Date().toISOString(),
    status_changed_at: new Date().toISOString(),
    currency: q.currency,
    customer_link_id: body.customer_link_id,
    storefront_order_number: body.storefront_order_number,
    fulfilment: body.fulfilment,
    payment: body.payment,
    lines: q.lines.map((l) => {
      const p = state.products.find((x) => x.link_id === l.product_link_id);
      const sku = p?.skus.find((x) => x.link_id === l.sku_link_id);
      return {
        product_link_id: l.product_link_id,
        sku_link_id: l.sku_link_id,
        product_name: p?.name ?? "Unknown",
        sku_label: sku ? sku.options.map((o) => o.value).join(" / ") : null,
        quantity: l.quantity,
        unit_price: l.unit_price,
        discount: l.discount,
        line_total: l.line_total,
      };
    }),
    subtotal: q.subtotal,
    discount_total: q.discount_total,
    delivery_fee: body.delivery_fee ?? "0.00",
    total: q.total,
  };
  state.orders.push(order);
  return { status: 201, body: { data: order } };
}

/** A scheme the engine may apply now (active, inside its dates, for this customer). */
function liveScheme(s, customer) {
  const now = Date.now();
  if (!s.is_active) return false;
  if (s.starts_at && Date.parse(s.starts_at) > now) return false;
  if (s.ends_at && Date.parse(s.ends_at) <= now) return false;
  if (s.audience === "customer_groups" && !PRICE_LEVELS[customer]) return false;
  return true;
}

function categoryWithParents(linkId) {
  const ids = [];
  let current = state.categories.find((c) => c.link_id === linkId);
  while (current && !ids.includes(current.link_id)) {
    ids.push(current.link_id);
    const parentId = current.parent_link_id;
    current = state.categories.find((c) => c.link_id === parentId);
  }
  return ids;
}

const cents = (n) => Math.round(n * 100);
const money = (c) => (c / 100).toFixed(2);

/**
 * Tiny stand-in for the ERP scheme engine: POST /prices/quote. Each line gets
 * the best line-level scheme; then order-level schemes apply to what is left.
 */
function quote(body) {
  const customer = body?.customer_link_id ?? null;
  const schemes = state.schemes.filter((s) => liveScheme(s, customer));
  const applied = new Map();
  const add = (s, c) => {
    const a = applied.get(s.link_id) ?? {
      scheme_id: s.link_id,
      name: s.name,
      description: s.description,
      discount: 0,
    };
    a.discount += c;
    applied.set(s.link_id, a);
  };

  const lines = [];
  for (const l of body?.lines ?? []) {
    const p0 = state.products.find((p) => p.link_id === l.product_link_id);
    if (!p0) return { error: 422, message: "A product in your cart is no longer available." };
    const p = forCustomer(p0, customer);
    const sku = l.sku_link_id ? p.skus.find((x) => x.link_id === l.sku_link_id) : null;
    const unit = cents(Number((sku ?? p).price.selling_price));
    const qty = l.quantity;
    const gross = unit * qty;
    const cats = categoryWithParents(p.category.link_id);
    const lineSchemes = schemes.filter(
      (x) => x.product_ids.includes(p.link_id) || x.category_ids.some((id) => cats.includes(id)),
    );
    let best = null;
    for (const x of lineSchemes) {
      let d = 0;
      if (x.kind === "percent") d = Math.round((gross * Number(x.reward_value)) / 100);
      if (x.kind === "fixed_price") d = Math.max(0, gross - cents(Number(x.reward_value)) * qty);
      if (x.kind === "buy_x_get_y")
        d = Math.floor(qty / (x.buy_quantity + x.get_quantity)) * x.get_quantity * unit;
      if (d > 0 && (!best || d > best.d)) best = { s: x, d };
    }
    if (best) add(best.s, best.d);
    const d = best?.d ?? 0;
    lines.push({
      product_link_id: p.link_id,
      sku_link_id: sku?.link_id ?? null,
      quantity: qty,
      unit_price: money(unit),
      discount: money(d),
      line_total: money(gross - d),
      scheme_ids: best ? [best.s.link_id] : [],
      gross,
      net: gross - d,
    });
  }

  const subtotal = lines.reduce((t, l) => t + l.gross, 0);
  let net = lines.reduce((t, l) => t + l.net, 0);
  const freeItems = [];
  const orderSchemes = schemes.filter(
    (x) => x.product_ids.length === 0 && x.category_ids.length === 0,
  );
  for (const x of orderSchemes) {
    if (x.min_spend && net < cents(Number(x.min_spend))) continue;
    let d = 0;
    if (x.kind === "amount") d = Math.min(net, cents(Number(x.reward_value)));
    if (x.kind === "percent") d = Math.round((net * Number(x.reward_value)) / 100);
    if (d > 0) {
      add(x, d);
      net -= d;
    }
  }

  return {
    data: {
      currency: "LKR",
      lines: lines.map((l) => ({ ...l, gross: undefined, net: undefined })),
      applied_schemes: [...applied.values()].map((a) => ({ ...a, discount: money(a.discount) })),
      free_items: freeItems,
      subtotal: money(subtotal),
      discount_total: money(subtotal - net),
      total: money(net),
    },
  };
}

let state = seed();

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve(null);
      }
    });
  });

function descendants(slug) {
  const root = state.categories.find((c) => c.slug === slug);
  if (!root) return [slug];
  const out = [root.slug];
  const walk = (id) =>
    state.categories
      .filter((c) => c.parent_link_id === id)
      .forEach((c) => (out.push(c.slug), walk(c.link_id)));
  walk(root.link_id);
  return out;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, ORIGIN);
  const path = url.pathname;
  const started = Date.now();
  res.on("finish", () =>
    console.log(
      `[mock-erp] ${req.method} ${path}${url.search} ${res.statusCode} ${Date.now() - started}ms`,
    ),
  );

  // Generated test photos (BUN-171 gallery): /images/gen/<label>.svg?bg=<hex>
  if (path.startsWith("/images/gen/")) {
    const label = decodeURIComponent(path.slice("/images/gen/".length).replace(/\.svg$/, ""))
      .replace(/[^\w .-]/g, "")
      .slice(0, 24);
    const bg = /^[0-9a-f]{6}$/i.test(url.searchParams.get("bg") ?? "")
      ? url.searchParams.get("bg")
      : "f4d7c2";
    res.writeHead(200, { "Content-Type": "image/svg+xml", "Cache-Control": "max-age=3600" });
    return res.end(
      `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">` +
        `<rect width="800" height="800" fill="#${bg}"/>` +
        `<circle cx="400" cy="360" r="180" fill="#ffffff" opacity="0.35"/>` +
        `<text x="400" y="640" font-family="sans-serif" font-size="56" font-weight="700" text-anchor="middle" fill="#4a2511">${label}</text>` +
        `</svg>`,
    );
  }

  // Test images
  if (path.startsWith("/images/")) {
    try {
      const file = await readFile(
        join(process.cwd(), "public", "brand", path.slice("/images/".length)),
      );
      res.writeHead(200, { "Content-Type": "image/png" });
      return res.end(file);
    } catch {
      return send(res, 404, { message: "Not Found" });
    }
  }

  // Admin endpoints for tests
  if (path.startsWith("/__mock/")) {
    if (path === "/__mock/state") return send(res, 200, state);
    if (path === "/__mock/reset") return ((state = seed()), send(res, 200, { ok: true }));
    if (path === "/__mock/orders") return send(res, 200, { data: state.orders });
    if (path === "/__mock/customers") return send(res, 200, { data: state.customers });
    if (path === "/__mock/customers/merge") {
      // {"from":"cust-1","into":"cust-walkin"}: merge two ERP customers, like staff would.
      const body = (await readBody(req)) ?? {};
      const from = state.customers.find((c) => c.link_id === body.from);
      if (!from) return send(res, 404, { message: "No such customer" });
      from.merged_into_link_id = body.into;
      return send(res, 200, { ok: true });
    }
    if (path === "/__mock/orders/status") {
      // {"number":"WEB-1001","status":"preparing","webhook":true}: change an order's status
      // like staff would, and (unless webhook is false) notify the storefront.
      const body = (await readBody(req)) ?? {};
      const order = state.orders.find(
        (o) => o.number === body.number || o.link_id === body.link_id,
      );
      if (!order) return send(res, 404, { message: "No such order" });
      order.status = body.status;
      order.status_changed_at = new Date().toISOString();
      const delivered = body.webhook === false ? "skipped" : await sendStatusWebhook(order);
      return send(res, 200, { ok: true, order, webhook: delivered });
    }
    if (path === "/__mock/fail") {
      // {"count": 2, "status": 503}: the next 2 writes fail with 503 (simulate an ERP outage).
      const body = (await readBody(req)) ?? {};
      state.failNext = { count: Number(body.count ?? 1), status: Number(body.status ?? 503) };
      return send(res, 200, { ok: true, failNext: state.failNext });
    }
    const body = await readBody(req);
    const idField = path === "/__mock/schemes" ? "link_id" : "slug";
    if (!body?.[idField]) return send(res, 422, { message: idField + " is required" });
    const list =
      path === "/__mock/products"
        ? state.products
        : path === "/__mock/categories"
          ? state.categories
          : path === "/__mock/schemes"
            ? state.schemes
            : null;
    if (!list) return send(res, 404, { message: "Not Found" });
    const i = list.findIndex((x) => x[idField] === body[idField]);
    const before = i >= 0 ? list[i] : null;
    if (i >= 0) list[i] = { ...list[i], ...body };
    else list.push(body);
    const item = list[i >= 0 ? i : list.length - 1];
    // Like the real ERP (BUN-246): tell the storefront what changed, unless
    // ?webhook=0 (simulates a lost webhook, for the scheduled catalog check).
    let webhook = "skipped";
    if (url.searchParams.get("webhook") !== "0") {
      const kind =
        path === "/__mock/products"
          ? "product"
          : path === "/__mock/categories"
            ? "category"
            : "schemes";
      const event =
        kind === "schemes"
          ? { type: "schemes" }
          : {
              type: kind,
              slug: item.slug,
              ...(before && before.slug !== item.slug ? { previous_slug: before.slug } : {}),
            };
      webhook = await sendRevalidate(event);
    }
    return send(res, 200, { ok: true, item, webhook });
  }

  // Storefront API
  const prefix = `/api/v1/tenants/${TENANT}/storefront`;
  if (!path.startsWith(prefix)) return send(res, 404, { message: "Not Found" });
  if (req.headers.authorization !== `Bearer ${API_KEY}`)
    return send(res, 401, { message: "Unauthenticated." });
  const route = path.slice(prefix.length);
  const q = url.searchParams;

  if (route === "/categories") return send(res, 200, { data: state.categories });
  if (route.startsWith("/categories/")) {
    const c = state.categories.find((x) => x.slug === decodeURIComponent(route.split("/")[2]));
    return c ? send(res, 200, { data: c }) : send(res, 404, { message: "Not Found" });
  }
  if (route === "/products") {
    let items = state.products;
    if (q.get("category")) {
      const slugs =
        q.get("include_subcategories") === "1"
          ? descendants(q.get("category"))
          : [q.get("category")];
      items = items.filter((p) => slugs.includes(p.category.slug));
    }
    if (q.get("featured") === "1") items = items.filter((p) => p.is_featured);
    if (q.get("on_offer") === "1") items = items.filter((p) => p.price.compare_at_price !== null);
    if (q.get("search")) {
      const s = q.get("search").toLowerCase();
      items = items.filter((p) => `${p.name} ${p.code} ${p.description}`.toLowerCase().includes(s));
    }
    return send(res, 200, { data: items });
  }
  if (route.startsWith("/products/")) {
    const p = state.products.find((x) => x.slug === decodeURIComponent(route.split("/")[2]));
    if (!p) return send(res, 404, { message: "Not Found" });
    return send(res, 200, { data: q.get("customer") ? forCustomer(p, q.get("customer")) : p });
  }
  if (route === "/banners") return send(res, 200, { data: state.banners });
  if (route === "/schemes") return send(res, 200, { data: state.schemes });
  // --- Writes (BUN-164): customers and orders, idempotent by Idempotency-Key ---
  if ((route === "/customers" || route === "/orders") && req.method === "POST") {
    if (state.failNext.count > 0) {
      state.failNext.count--;
      return send(res, state.failNext.status, { message: "Simulated ERP outage" });
    }
    const key = req.headers["idempotency-key"];
    if (!key) return send(res, 422, { message: "Idempotency-Key header is required." });
    const seen = state.idempotency[`${route}:${key}`];
    if (seen) return send(res, seen.status, seen.body);
    const body = (await readBody(req)) ?? {};
    const result = route === "/customers" ? createCustomer(body) : createOrder(body);
    if (result.status < 400) state.idempotency[`${route}:${key}`] = result;
    return send(res, result.status, result.body);
  }
  if (route.startsWith("/customers/") && req.method === "PUT") {
    if (state.failNext.count > 0) {
      state.failNext.count--;
      return send(res, state.failNext.status, { message: "Simulated ERP outage" });
    }
    const key = req.headers["idempotency-key"];
    const id = decodeURIComponent(route.split("/")[2]);
    const seen = key ? state.idempotency[`PUT ${route}:${key}`] : undefined;
    if (seen) return send(res, seen.status, seen.body);
    const result = updateCustomer(id, (await readBody(req)) ?? {});
    if (key && result.status < 400) state.idempotency[`PUT ${route}:${key}`] = result;
    return send(res, result.status, result.body);
  }
  if (route.startsWith("/customers/")) {
    const c = state.customers.find((x) => x.link_id === decodeURIComponent(route.split("/")[2]));
    return c ? send(res, 200, { data: c }) : send(res, 404, { message: "Not Found" });
  }
  if (route.startsWith("/orders/")) {
    const o = state.orders.find((x) => x.link_id === decodeURIComponent(route.split("/")[2]));
    return o ? send(res, 200, { data: o }) : send(res, 404, { message: "Not Found" });
  }
  if (route === "/prices/quote" && req.method === "POST") {
    const result = quote(await readBody(req));
    return result.error
      ? send(res, result.error, { message: result.message })
      : send(res, 200, result);
  }
  return send(res, 404, { message: "Not Found" });
});

export { server };

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-erp] listening on ${ORIGIN} (tenant "${TENANT}", key "${API_KEY}")`);
});
