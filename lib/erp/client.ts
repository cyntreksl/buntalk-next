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
 * Thin fetch wrapper for ERP calls. Extended with typed endpoints in BUN-159.
 *
 * Caching is not done here: callers wrap ERP reads in `'use cache'` with a
 * cacheLife profile and cache tags (see lib/erp/catalog.ts).
 */
export async function erpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = erpConfig();
  if (!config) {
    throw new Error("ERP is not configured: set ERP_API_BASE_URL and ERP_API_KEY.");
  }
  const url = `${config.baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      ...init?.headers,
    },
  });

  if (res.status === 404) {
    throw new ErpError("ERP resource not found", 404, path);
  }
  if (!res.ok) {
    throw new ErpError(`ERP request failed: ${res.status} ${res.statusText}`, res.status, path);
  }
  return (await res.json()) as T;
}
