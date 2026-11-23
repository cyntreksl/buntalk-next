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
  // Storefront database (orders, ERP submission queue): postgres://user:pass@host:5432/db
  DATABASE_URL: optional(z.string().regex(/^postgres(ql)?:\/\//, "a postgres:// URL")),
  // Local only, without DATABASE_URL: folder for the embedded PGlite database.
  // Default node_modules/.cache/buntalk/pglite: outside the dev server's file
  // watcher (a watched folder would trigger a rebuild on every database write).
  PGLITE_DIR: optional(z.string()),
  // Secret for the order operations endpoints (retry queue, failed orders), at least 16 characters
  ORDERS_OPS_SECRET: optional(z.string().min(16)),
  // Shared secret the ERP signs its webhooks with (catalog revalidation, order
  // status; HMAC-SHA256, lib/webhooks/signature.ts), at least 16 characters
  ERP_WEBHOOK_SECRET: optional(z.string().min(16)),
  // Optional: Slack/Teams-compatible incoming webhook for order alerts ({ "text": … })
  ALERT_WEBHOOK_URL: optional(z.url()),
  // Cake Studio (BUN-181): "native" (default) is the storefront's own designer on the ERP API;
  // "embed" shows the ERP's Cake Studio in a frame (BUN-180, needs the two settings below).
  CAKE_STUDIO_MODE: optional(z.enum(["native", "embed"])),
  // Cake Studio embed (BUN-180): the ERP's embed page, e.g. https://erp.example.com/buntalk/cake-studio/embed
  CAKE_STUDIO_EMBED_URL: optional(z.url()),
  // Shared secret the storefront signs Cake Studio embed sessions with (HMAC-SHA256), at least 16 characters
  CAKE_STUDIO_EMBED_SECRET: optional(z.string().min(16)),
  // Sign-in (BUN-186): secret that signs session cookies, at least 32 random characters
  // (e.g. `openssl rand -base64 32`). Required outside local development.
  AUTH_SECRET: optional(z.string().min(32)),
  // Sign-in: the site's public origin, if different from NEXT_PUBLIC_SITE_URL.
  AUTH_URL: optional(z.url()),
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

/** Used only in local development when AUTH_SECRET isn't set. Never valid anywhere else. */
const LOCAL_AUTH_SECRET = "local-development-only-auth-secret-not-for-production";

/**
 * Sign-in settings (BUN-186): the secret that signs session cookies and the
 * site's origin. Outside local development AUTH_SECRET is required.
 */
export function authConfig(): { secret: string; baseUrl: string } {
  const { AUTH_SECRET, AUTH_URL } = serverEnv();
  if (!AUTH_SECRET && publicEnv.NEXT_PUBLIC_APP_ENV !== "local") {
    throw new Error("AUTH_SECRET is required outside local development (see .env.example).");
  }
  return {
    secret: AUTH_SECRET ?? LOCAL_AUTH_SECRET,
    baseUrl: (AUTH_URL ?? publicEnv.NEXT_PUBLIC_SITE_URL).replace(/\/$/, ""),
  };
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
  return { kind: "pglite", dir: PGLITE_DIR ?? "node_modules/.cache/buntalk/pglite" };
}
