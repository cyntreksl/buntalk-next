import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import {
  deleteStaleGuestCarts,
  hashCartToken,
  loadCart,
  mergeGuestCart,
  newCartToken,
  normalizeLines,
  saveCart,
} from "./persist.server";

let db: Db;

beforeEach(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: join(process.cwd(), "drizzle") });
  db = d as unknown as Db;
});

const line = (productSlug: string, quantity: number, extra: object = {}) => ({
  productSlug,
  name: productSlug,
  unitPrice: 100,
  quantity,
  ...extra,
});

describe("normalizeLines", () => {
  it("works out the key, merges duplicates and keeps quantities within 99", () => {
    const lines = normalizeLines([
      line("fish-bun", 60, { key: "anything" } as object),
      line("fish-bun", 60),
      line("cake", 1, { skuId: "s1" }),
      line("studio", 1, { customization: { designId: "d1", summary: ["Chocolate"] } }),
    ]);
    expect(lines.map((l) => [l.key, l.quantity])).toEqual([
      ["fish-bun", 99],
      ["cake:s1", 1],
      ["studio:design-d1", 1],
    ]);
  });

  it("refuses invalid lines", () => {
    expect(() => normalizeLines([line("fish-bun", 0)])).toThrow();
  });
});

describe("saved carts", () => {
  it("saves and loads a guest cart by its token, never storing the token", async () => {
    const token = newCartToken();
    const owner = { tokenHash: hashCartToken(token) };
    await saveCart(db, owner, normalizeLines([line("fish-bun", 2)]));
    const saved = await saveCart(db, owner, normalizeLines([line("fish-bun", 3)]));
    expect(saved.lines.map((l) => l.quantity)).toEqual([3]);
    expect((await loadCart(db, owner))?.lines).toEqual(saved.lines);
    expect(await loadCart(db, { tokenHash: hashCartToken(newCartToken()) })).toBeNull();
    const rows = await db.execute(sql`select token_hash from carts`);
    expect(JSON.stringify(rows)).not.toContain(token);
  });

  it("keeps a customer's cart apart from guest carts", async () => {
    await saveCart(db, { customerId: "cust-1" }, normalizeLines([line("cake", 1)]));
    await saveCart(db, { tokenHash: "h" }, normalizeLines([line("fish-bun", 1)]));
    expect((await loadCart(db, { customerId: "cust-1", tokenHash: "h" }))?.lines[0].key).toBe(
      "cake",
    );
  });

  it("deletes guest carts after 60 days without changes, never customer carts", async () => {
    await saveCart(db, { tokenHash: "old" }, []);
    await saveCart(db, { tokenHash: "new" }, []);
    await saveCart(db, { customerId: "cust-1" }, []);
    await db.execute(
      sql`update carts set updated_at = now() - interval '61 days' where token_hash = 'old' or customer_id = 'cust-1'`,
    );
    expect(await deleteStaleGuestCarts(db)).toBe(1);
    expect(await loadCart(db, { tokenHash: "new" })).not.toBeNull();
    expect(await loadCart(db, { customerId: "cust-1" })).not.toBeNull();
  });
});

describe("saving with a version check (BUN-178)", () => {
  it("saves when nothing changed since the browser last saw the cart", async () => {
    const first = await saveCart(db, { tokenHash: "h" }, normalizeLines([line("fish-bun", 1)]));
    const next = await saveCart(db, { tokenHash: "h" }, normalizeLines([line("fish-bun", 2)]), {
      baseUpdatedAt: first.updatedAt,
    });
    expect(next.conflict).toBeUndefined();
    expect(next.lines[0].quantity).toBe(2);
  });

  it("refuses to overwrite a cart that changed since, and returns it", async () => {
    const first = await saveCart(db, { customerId: "c1" }, normalizeLines([line("cake", 1)]));
    await new Promise((r) => setTimeout(r, 5));
    await saveCart(db, { customerId: "c1" }, normalizeLines([line("cake", 2)]));
    const stale = await saveCart(db, { customerId: "c1" }, normalizeLines([line("bun", 1)]), {
      baseUpdatedAt: first.updatedAt,
    });
    expect(stale.conflict).toBe(true);
    expect(stale.lines.map((l) => [l.key, l.quantity])).toEqual([["cake", 2]]);
    expect((await loadCart(db, { customerId: "c1" }))?.lines[0].quantity).toBe(2);
  });

  it("refuses a browser that never saw the saved cart, but not a brand-new cart", async () => {
    await saveCart(db, { customerId: "c1" }, normalizeLines([line("cake", 1)]));
    const unseen = await saveCart(db, { customerId: "c1" }, [], { baseUpdatedAt: null });
    expect(unseen.conflict).toBe(true);
    const fresh = await saveCart(db, { tokenHash: "new" }, normalizeLines([line("bun", 1)]), {
      baseUpdatedAt: null,
    });
    expect(fresh.conflict).toBeUndefined();
  });
});

describe("mergeGuestCart (sign-in, BUN-178)", () => {
  it("moves the guest cart into the customer's cart and deletes the guest cart", async () => {
    await saveCart(
      db,
      { customerId: "c1" },
      normalizeLines([line("cake", 1), line("fish-bun", 2)]),
    );
    await saveCart(db, { tokenHash: "g" }, normalizeLines([line("fish-bun", 3), line("roll", 1)]));
    const merged = await mergeGuestCart(db, { tokenHash: "g", customerId: "c1" });
    expect(merged.lines.map((l) => [l.key, l.quantity])).toEqual([
      ["cake", 1],
      ["fish-bun", 5],
      ["roll", 1],
    ]);
    expect(merged.merged).toBe(2);
    expect(await loadCart(db, { tokenHash: "g" })).toBeNull();
    expect((await loadCart(db, { customerId: "c1" }))?.lines).toEqual(merged.lines);
  });

  it("creates the customer's cart from the guest cart when there is none", async () => {
    await saveCart(db, { tokenHash: "g" }, normalizeLines([line("roll", 2)]));
    const merged = await mergeGuestCart(db, { tokenHash: "g", customerId: "new-customer" });
    expect(merged.lines.map((l) => [l.key, l.quantity])).toEqual([["roll", 2]]);
  });

  it("is safe to run twice: the second time changes nothing", async () => {
    await saveCart(db, { tokenHash: "g" }, normalizeLines([line("roll", 2)]));
    await mergeGuestCart(db, { tokenHash: "g", customerId: "c1" });
    const again = await mergeGuestCart(db, { tokenHash: "g", customerId: "c1" });
    expect(again.merged).toBe(0);
    expect(again.lines.map((l) => [l.key, l.quantity])).toEqual([["roll", 2]]);
  });
});
