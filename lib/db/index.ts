import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { databaseConfig } from "@/lib/env.server";
import * as schema from "./schema";

/**
 * The storefront database (orders and the ERP submission queue).
 *
 * - DATABASE_URL set: PostgreSQL through node-postgres. Migrations are applied
 *   explicitly with `npm run db:migrate` (deploy step), never on request.
 * - Local development without DATABASE_URL: an embedded PGlite database
 *   (real Postgres in WebAssembly) in PGLITE_DIR, migrated automatically on
 *   first use, so nothing needs installing.
 *
 * Server only. One connection pool per server process (kept on globalThis so
 * dev hot reloads don't open new pools).
 */

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export { schema };

const MIGRATIONS = join(process.cwd(), "drizzle");

async function open(): Promise<Db> {
  const config = databaseConfig();
  if (config.kind === "postgres") {
    const [{ drizzle }, { Pool }] = await Promise.all([
      import("drizzle-orm/node-postgres"),
      import("pg"),
    ]);
    const pool = new Pool({ connectionString: config.url, max: 10 });
    return drizzle(pool, { schema }) as unknown as Db;
  }

  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  // PGlite creates the database folder, but not its parents.
  mkdirSync(dirname(config.dir), { recursive: true });
  const client = new PGlite(config.dir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

const globalForDb = globalThis as unknown as { buntalkDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  globalForDb.buntalkDb ??= open().catch((error) => {
    globalForDb.buntalkDb = undefined; // let the next request try again
    throw error;
  });
  return globalForDb.buntalkDb;
}
