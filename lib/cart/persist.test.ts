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
