import { z } from "zod";

/**
 * Public env — safe to import anywhere (server or client).
 * NEXT_PUBLIC_* values are inlined at build time, so each one must be
 * referenced explicitly (no `process.env[key]` lookups).
 */
const publicSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

export const isProduction = publicEnv.NEXT_PUBLIC_APP_ENV === "production";
