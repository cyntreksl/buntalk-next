import "server-only";
import { serverEnv } from "@/lib/env.server";

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

/** Thin fetch wrapper for ERP calls. Extended with typed endpoints in BUN-159. */
export async function erpFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { ERP_API_BASE_URL, ERP_API_KEY } = serverEnv();
  const url = `${ERP_API_BASE_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${ERP_API_KEY}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    throw new ErpError(`ERP request failed: ${res.status} ${res.statusText}`, res.status, path);
  }
  return (await res.json()) as T;
}
