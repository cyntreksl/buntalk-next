import "server-only";
import { erpConfig } from "@/lib/env.server";

export class ErpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "ErpError";
  }
}

/**
 * The ERP could not be reached or answered with a server error (network
 * failure, timeout, 5xx). Pages show the friendly error screen for this
 * (app/(site)/error.tsx); the header and footer fall back to no category links.
 */
export class ErpUnavailableError extends ErpError {
  constructor(path: string, cause: string) {
    super(`ERP unavailable (${cause})`, 503, path);
    this.name = "ErpUnavailableError";
  }
}

/** How long to wait for the ERP before giving up, so a slow ERP can't hang page renders. */
const ERP_TIMEOUT_MS = 10_000;

/**
 * Thin fetch wrapper for ERP calls. Extended with typed endpoints in BUN-159.
 *
 * Caching is not done here: callers wrap ERP reads in `'use cache'` with a
 * cacheLife profile and cache tags (see lib/erp/catalog.ts). When a cached
 * page refreshes in the background and the ERP is down, Next.js keeps serving
 * the last good version, so visitors only see the error screen for pages that
 * were never cached.
 */
export async function erpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = erpConfig();
  if (!config) {
    throw new Error("ERP is not configured: set ERP_API_BASE_URL and ERP_API_KEY.");
  }
  const url = `${config.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(ERP_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        ...init?.headers,
      },
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError" ? "timed out" : "network error";
    throw new ErpUnavailableError(path, reason);
  }

  if (res.status === 404) {
    throw new ErpError("ERP resource not found", 404, path);
  }
  if (res.status >= 500) {
    throw new ErpUnavailableError(path, `${res.status} ${res.statusText}`);
  }
  if (!res.ok) {
    throw new ErpError(`ERP request failed: ${res.status} ${res.statusText}`, res.status, path);
  }
  return (await res.json()) as T;
}
