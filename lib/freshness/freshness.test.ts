import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { signPayload } from "@/lib/webhooks/signature";
import { changeRequestSchema, tagsForEvents } from "./events";
import { diffFingerprints, hashItem } from "./fingerprint";

const revalidated: string[] = [];
vi.mock("next/cache", () => ({ revalidateTag: (tag: string) => void revalidated.push(tag) }));
const getCatalogSnapshot = vi.fn();
vi.mock("@/lib/erp", () => ({ getCatalogSnapshot: () => getCatalogSnapshot() }));

const SECRET = "erp-webhook-secret-for-tests";
vi.stubEnv("ERP_WEBHOOK_SECRET", SECRET);

const { checkCatalog } = await import("./check");
const { POST: revalidate } = await import("@/app/api/revalidate/route");

beforeEach(() => {
  revalidated.length = 0;
});

describe("change events → cache tags", () => {
  it("refreshes a product, its old slug after a rename, and every list that shows it", () => {
    const events = changeRequestSchema.parse({
      type: "product",
      slug: "fish-bun",
      previous_slug: "fish-bun-old",
    });
    expect(tagsForEvents(events)).toEqual(["product:fish-bun", "product:fish-bun-old", "products"]);
  });

  it("accepts a batch, removes duplicates, and lets 'all' replace everything", () => {
    const batch = changeRequestSchema.parse({
      events: [{ type: "product", slug: "a" }, { type: "product", slug: "b" }, { type: "banners" }],
    });
    expect(tagsForEvents(batch)).toEqual(["product:a", "products", "product:b", "banners", "home"]);
    expect(
      tagsForEvents(changeRequestSchema.parse({ events: [{ type: "schemes" }, { type: "all" }] })),
    ).toEqual(["catalog"]);
  });

  it("refreshes the Cake Studio menu when the ERP changes it (BUN-179)", () => {
    expect(tagsForEvents(changeRequestSchema.parse({ type: "cake_studio" }))).toEqual([
      "cake-studio",
    ]);
  });

  it("rejects unknown types", () => {
    expect(changeRequestSchema.safeParse({ type: "everything" }).success).toBe(false);
  });
});

describe("fingerprints", () => {
  it("ignores key order but sees any value change", () => {
    expect(hashItem({ a: 1, b: { c: 2 } })).toBe(hashItem({ b: { c: 2 }, a: 1 }));
    expect(hashItem({ a: 1 })).not.toBe(hashItem({ a: 2 }));
  });

  it("reports changed, new and removed items, and one event per scheme/banner group", () => {
    const before = new Map([
      ["product:a", "1"],
      ["product:gone", "1"],
      ["category:cakes", "1"],
      ["scheme:s1", "1"],
      ["scheme:s2", "1"],
    ]);
    const after = new Map([
      ["product:a", "2"],
      ["product:new", "1"],
      ["category:cakes", "1"],
      ["scheme:s1", "2"],
      ["scheme:s2", "3"],
    ]);
    expect(diffFingerprints(before, after)).toEqual([
      { type: "product", slug: "a" },
      { type: "product", slug: "gone" },
      { type: "product", slug: "new" },
      { type: "schemes" },
    ]);
  });
});

describe("scheduled catalog check", () => {
  let db: Db;
  const product = (slug: string, price: string, extra: object = {}) => ({
    slug,
    link_id: `p-${slug}`,
    is_active: true,
    price: { selling_price: price },
    ...extra,
  });
  const snapshot = (products: object[], schemes: object[] = []) => ({
    categories: [{ slug: "buns", link_id: "c-buns", is_active: true }],
    products,
    schemes,
    banners: [],
  });

  beforeEach(async () => {
    const d = drizzle(new PGlite(), { schema });
    await migrate(d, { migrationsFolder: join(process.cwd(), "drizzle") });
    db = d as unknown as Db;
  });

  it("records a baseline first, then refreshes exactly what changed (price, visibility)", async () => {
    getCatalogSnapshot.mockResolvedValue(
      snapshot([product("fish-bun", "120.00"), product("tea-bun", "60.00")]),
    );
    const t0 = new Date("2026-11-22T10:00:00Z");
    expect(await checkCatalog(db, { now: t0 })).toEqual({ status: "baseline", items: 3 });
    expect(revalidated).toEqual([]);

    // Inside 5 minutes: skipped, the ERP isn't even read.
    getCatalogSnapshot.mockClear();
    expect((await checkCatalog(db, { now: new Date("2026-11-22T10:03:00Z") })).status).toBe(
      "skipped",
    );
    expect(getCatalogSnapshot).not.toHaveBeenCalled();

    // A price change and a product hidden online, without any webhook.
    getCatalogSnapshot.mockResolvedValue(
      snapshot([
        product("fish-bun", "135.00"),
        product("tea-bun", "60.00", { visible_online: false }),
      ]),
    );
    const result = await checkCatalog(db, { now: new Date("2026-11-22T10:05:00Z") });
    expect(result).toMatchObject({
      status: "checked",
      events: [
        { type: "product", slug: "fish-bun" },
        { type: "product", slug: "tea-bun" },
      ],
    });
    expect(revalidated).toEqual(["product:fish-bun", "products", "product:tea-bun"]);

    // Nothing changed since: nothing refreshed.
    revalidated.length = 0;
    expect(await checkCatalog(db, { now: new Date("2026-11-22T10:10:00Z") })).toMatchObject({
      status: "checked",
      events: [],
    });
    expect(revalidated).toEqual([]);
  });

  it("keeps the previous fingerprints when the ERP can't be read", async () => {
    getCatalogSnapshot.mockResolvedValue(snapshot([product("fish-bun", "120.00")]));
    await checkCatalog(db, { now: new Date("2026-11-22T10:00:00Z") });
    getCatalogSnapshot.mockRejectedValue(new Error("ERP down"));
    await expect(checkCatalog(db, { now: new Date("2026-11-22T10:06:00Z") })).rejects.toThrow();
    // ERP back with a change: it's still detected.
    getCatalogSnapshot.mockResolvedValue(snapshot([product("fish-bun", "130.00")]));
    expect(await checkCatalog(db, { now: new Date("2026-11-22T10:07:00Z") })).toMatchObject({
      events: [{ type: "product", slug: "fish-bun" }],
    });
  });
});

describe("POST /api/revalidate", () => {
  const send = (body: string, signature?: string) =>
    revalidate(
      new Request("http://localhost/api/revalidate", {
        method: "POST",
        headers: signature ? { "X-Erp-Signature": signature } : {},
        body,
      }),
    );
  const now = () => Math.floor(Date.now() / 1000);

  it("rejects unsigned, wrongly signed and replayed (old) requests", async () => {
    const body = JSON.stringify({ type: "all" });
    expect((await send(body)).status).toBe(401);
    expect((await send(body, signPayload("not-the-secret-123", body, now()))).status).toBe(401);
    expect((await send(body, signPayload(SECRET, body, now() - 600))).status).toBe(401);
    expect(revalidated).toEqual([]);
  });

  it("refreshes the tags for a correctly signed request", async () => {
    const body = JSON.stringify({
      events: [{ type: "product", slug: "fish-bun" }, { type: "schemes" }],
    });
    const res = await send(body, signPayload(SECRET, body, now()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revalidated: ["product:fish-bun", "products", "schemes"] });
    expect(revalidated).toEqual(["product:fish-bun", "products", "schemes"]);
  });

  it("refuses a signed request with an invalid body", async () => {
    const body = JSON.stringify({ type: "product" });
    expect((await send(body, signPayload(SECRET, body, now()))).status).toBe(400);
  });
});
