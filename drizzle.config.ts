import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit: `npm run db:generate` creates SQL migrations in ./drizzle from
 * lib/db/schema.ts. Migrations are applied by `npm run db:migrate`
 * (scripts/db-migrate.mjs), which works for PostgreSQL (DATABASE_URL) and the
 * local PGlite database.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
});
