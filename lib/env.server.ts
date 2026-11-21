import "server-only";
import { z } from "zod";

/**
 * Server-only env. Importing this from a Client Component fails the build,
 * so secrets such as ERP_API_KEY can never reach the browser bundle.
 *
 * Parsed lazily so `next build` and pages that do not call the ERP
 * work without these values set.
 */
const serverSchema = z.object({
  ERP_API_BASE_URL: z.url(),
  ERP_API_KEY: z.string().min(1),
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
