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
 */
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

const PORT = Number(process.env.MOCK_ERP_PORT ?? 4010);
const API_KEY = process.env.MOCK_ERP_KEY ?? "mock-key";
const TENANT = process.env.MOCK_ERP_TENANT ?? "buntalk";
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
    },
    {
      slug: "sausage-bun",
      name: "Sausage bun",
      category: cat("buns"),
      price: price(150, 180),
      image_url: null,
    },
    {
      slug: "vegetable-roll",
      name: "Vegetable roll",
      category: cat("short-eats"),
      price: price(90),
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
        { name: "Message", values: ["Happy Birthday", "Custom"] },
      ],
      processing_time_hours: 48,
      // Sizes with their own prices (BUN-162). 3 kg is sold out online.
      skus: [
        sku("1KG", "1 kg", 4500),
        sku("2KG", "2 kg", 8500),
        sku("3KG", "3 kg", 12000, { in_stock: false }),
        sku("5KG", "5 kg", 19000, { visible_online: false }),
      ],
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
    processing_time_hours: null,
    skus: [],
    ...p,
  }));
  return { categories, products, banners: [] };
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
    const body = await readBody(req);
    if (!body?.slug) return send(res, 422, { message: "slug is required" });
    const list =
      path === "/__mock/products"
        ? state.products
        : path === "/__mock/categories"
          ? state.categories
          : null;
    if (!list) return send(res, 404, { message: "Not Found" });
    const i = list.findIndex((x) => x.slug === body.slug);
    if (i >= 0) list[i] = { ...list[i], ...body };
    else list.push(body);
    return send(res, 200, { ok: true, item: list[i >= 0 ? i : list.length - 1] });
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
  return send(res, 404, { message: "Not Found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-erp] listening on ${ORIGIN} (tenant "${TENANT}", key "${API_KEY}")`);
});
