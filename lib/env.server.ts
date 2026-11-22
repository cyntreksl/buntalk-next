import "server-only";
import { z } from "zod";
import { publicEnv } from "@/lib/env";

/**
 * Server-only env. Importing this from a Client Component fails the build,
 * so secrets such as ERP_API_KEY can never reach the browser bundle.
 *
 * Parsed lazily so `next build` and pages that do not call the ERP
 * work without these values set.
 */

// `KEY=` in a .env file gives an empty string; treat it as "not set".
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const serverSchema = z.object({
  // ERP API root, e.g. https://erp.example.com/api (see docs/erp-api-contract.md)
  ERP_API_BASE_URL: optional(z.url()),
  ERP_API_KEY: optional(z.string()),
  // The Buntalk business (tenant) ID in the ERP. The ERP is multi-tenant.
  ERP_TENANT: optional(z.string().regex(/^[A-Za-z0-9_-]+$/, "letters, numbers, - and _ only")),
  // Per-request time limit in milliseconds (default 8000).
  ERP_TIMEOUT_MS: optional(z.coerce.number().int().min(1000).max(60_000)),
  // Shared secret the ERP sends when it calls /api/revalidate
  REVALIDATE_SECRET: optional(z.string().min(16)),
  // Storefront database (orders, ERP submission queue): postgres://user:pass@host:5432/db
  DATABASE_URL: optional(z.string().regex(/^postgres(ql)?:\/\//, "a postgres:// URL")),
  // Local only, without DATABASE_URL: folder for the embedded PGlite database (default .data/pglite)
  PGLITE_DIR: optional(z.string()),
  // Secret for the order operations endpoints (retry queue, failed orders), at least 16 characters
  ORDERS_OPS_SECRET: optional(z.string().min(16)),
  // Optional: Slack/Teams-compatible incoming webhook for order alerts ({ "text": … })
  ALERT_WEBHOOK_URL: optional(z.url()),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (!cached) {
    const result = serverSchema.safeParse(process.env);
    if (!result.success) {
      throw new Error(
        `Invalid server environment variables:\n${z.prettifyError(result.error)}\n` +
          "See .env.example for the required values.",
      );
    }
    cached = result.data;
  }
  return cached;
}

export type ErpConfig = { baseUrl: string; apiKey: string; tenant: string; timeoutMs: number };

/**
 * ERP connection settings, or null when the ERP is not configured.
 * Only lib/erp may call this (enforced by ESLint), so ERP credentials stay in
 * one server-only module and never reach the browser.
 */
export function erpConfig(): ErpConfig | null {
  const { ERP_API_BASE_URL, ERP_API_KEY, ERP_TENANT, ERP_TIMEOUT_MS } = serverEnv();
  if (!ERP_API_BASE_URL || !ERP_API_KEY || !ERP_TENANT) return null;
  return {
    baseUrl: ERP_API_BASE_URL.replace(/\/$/, ""),
    apiKey: ERP_API_KEY,
    tenant: ERP_TENANT,
    timeoutMs: ERP_TIMEOUT_MS ?? 8000,
  };
}

/**
 * Local development without ERP credentials uses built-in sample data.
 * Staging and production must always have the ERP configured.
 */
export function isSampleCatalogEnabled(): boolean {
  return erpConfig() === null && publicEnv.NEXT_PUBLIC_APP_ENV === "local";
}

export type DatabaseConfig = { kind: "postgres"; url: string } | { kind: "pglite"; dir: string };

/**
 * Where the storefront database lives.
 * - DATABASE_URL set: PostgreSQL (staging and production must set it).
 * - Local development without it: an embedded PGlite database in a folder.
 *   PGlite is real Postgres compiled to WebAssembly, so the schema and SQL
 *   are the same.
 */
export function databaseConfig(): DatabaseConfig {
  const { DATABASE_URL, PGLITE_DIR } = serverEnv();
  if (DATABASE_URL) return { kind: "postgres", url: DATABASE_URL };
  if (publicEnv.NEXT_PUBLIC_APP_ENV !== "local") {
    throw new Error("DATABASE_URL is required outside local development (see .env.example).");
  }
  return { kind: "pglite", dir: PGLITE_DIR ?? ".data/pglite" };
}
