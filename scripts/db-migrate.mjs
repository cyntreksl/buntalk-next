#!/usr/bin/env node
/**
 * Applies the SQL migrations in ./drizzle to the storefront database.
 *
 *   npm run db:migrate
 *
 * Uses DATABASE_URL (PostgreSQL) when set, otherwise the local PGlite
 * database in PGLITE_DIR (default node_modules/.cache/buntalk/pglite). Reads .env.local / .env when
 * present. Run it as a deploy step before starting a new version.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file not present
  }
}

const migrationsFolder = join(process.cwd(), "drizzle");
const url = process.env.DATABASE_URL;

if (url) {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url });
  await migrate(drizzle(pool), { migrationsFolder });
  await pool.end();
  console.log("[db] PostgreSQL migrations applied");
} else {
  const dir = process.env.PGLITE_DIR || "node_modules/.cache/buntalk/pglite";
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // PGlite creates the database folder, but not its parents.
  mkdirSync(dirname(dir), { recursive: true });
  const client = new PGlite(dir);
  await migrate(drizzle(client), { migrationsFolder });
  await client.close();
  console.log(`[db] PGlite migrations applied (${dir})`);
}
