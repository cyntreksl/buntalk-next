import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { listSearchMisses, recordSearchMiss } from "./search-misses";

let db: Db;

beforeEach(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: join(process.cwd(), "drizzle") });
  db = d as unknown as Db;
});

/** Pretend the query was last seen a minute ago. */
const age = () =>
  db.execute(sql`update search_misses set last_seen_at = now() - interval '1 minute'`);

describe("no-result search tracking", () => {
  it("stores the normalised query and counts repeat searches", async () => {
    await recordSearchMiss(db, "  Gluten-FREE bread ");
    await age();
    await recordSearchMiss(db, "gluten free bread");
    const [miss] = await listSearchMisses(db);
    expect(miss).toMatchObject({ query: "gluten free bread", count: 2 });
  });

  it("counts the same query only once within a few seconds", async () => {
    await recordSearchMiss(db, "rye loaf");
    await recordSearchMiss(db, "rye loaf");
    expect((await listSearchMisses(db))[0].count).toBe(1);
  });

  it("ignores one-letter queries and lists the most searched first", async () => {
    await recordSearchMiss(db, "x");
    await recordSearchMiss(db, "rye");
    await recordSearchMiss(db, "naan");
    await age();
    await recordSearchMiss(db, "naan");
    expect((await listSearchMisses(db)).map((m) => [m.query, m.count])).toEqual([
      ["naan", 2],
      ["rye", 1],
    ]);
  });
});
