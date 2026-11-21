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
  ERP_API_BASE_URL: optional(z.url()),
  ERP_API_KEY: optional(z.string()),
  // Shared secret the ERP sends when it calls /api/revalidate
  REVALIDATE_SECRET: optional(z.string().min(16)),
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

/** ERP connection settings, or null when the ERP is not configured. */
export function erpConfig(): { baseUrl: string; apiKey: string } | null {
  const { ERP_API_BASE_URL, ERP_API_KEY } = serverEnv();
  if (!ERP_API_BASE_URL || !ERP_API_KEY) return null;
  return { baseUrl: ERP_API_BASE_URL, apiKey: ERP_API_KEY };
}

/**
 * Local development without ERP credentials uses built-in sample data.
 * Staging and production must always have the ERP configured.
 */
export function isSampleCatalogEnabled(): boolean {
  return erpConfig() === null && publicEnv.NEXT_PUBLIC_APP_ENV === "local";
}
