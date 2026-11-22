import "server-only";
import type { z } from "zod";
import { erpConfig, type ErpConfig } from "@/lib/env.server";
import {
  ErpConfigError,
  ErpConflictError,
  ErpError,
  ErpNotFoundError,
  ErpResponseError,
  ErpUnavailableError,
  ErpValidationError,
  isRetryable,
} from "./errors";
import { erpErrorBodySchema } from "./schemas";

/**
 * The one HTTP client for the ERP. Internal to lib/erp: features call the
 * typed functions in lib/erp (catalog.ts, …), never this directly (enforced
 * by ESLint), and never `fetch` the ERP themselves.
 *
 * - Base URL, tenant and API key come from server-only env (lib/env.server.ts).
 * - Every request has a time limit (ERP_TIMEOUT_MS, default 8s).
 * - Safe requests (GET) are retried on network errors, timeouts, 429 and 5xx:
 *   up to 2 retries with exponential back-off and jitter, honouring Retry-After.
 *   Writes (POST/PUT/…) are never retried automatically, to avoid double orders.
 * - Every response is checked against a zod schema.
 * - Every failure becomes a storefront error type (lib/erp/errors.ts).
 * - One log line per request: method, path, status, time, attempt, request ID.
 *   Bodies, query values and credentials are never logged.
 */

export type ErpRequest<S extends z.ZodType> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path below /v1/tenants/{tenant}/storefront, e.g. "/products". */
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Response schema. */
  schema: S;
  /** For writes: sent as Idempotency-Key so the ERP can ignore duplicates. */
  idempotencyKey?: string;
  /** Override the retry count (GET default 2, writes always 0). */
  retries?: number;
  /**
   * A POST that changes nothing (e.g. a price quote): retried like a GET.
   * Never set this on a request that creates or changes data.
   */
  readOnly?: boolean;
};

const DEFAULT_RETRIES = 2;
const BASE_DELAY_MS = 250;
const MAX_DELAY_MS = 4000;

/** Test hooks: swap the transport, clock and logger. */
export const transport = {
  fetch: (input: string, init: RequestInit) => fetch(input, init),
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  log: (level: "info" | "warn" | "error", line: string) => console[level](line),
  config: (): ErpConfig | null => erpConfig(),
};

function buildUrl(config: ErpConfig, path: string, query?: ErpRequest<z.ZodType>["query"]) {
  const url = new URL(
    `${config.baseUrl}/v1/tenants/${encodeURIComponent(config.tenant)}/storefront${path}`,
  );
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

function backoffDelay(attempt: number, retryAfterHeader: string | null): number {
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) * 1000 : NaN;
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter, MAX_DELAY_MS);
  const exponential = BASE_DELAY_MS * 2 ** (attempt - 1);
  return Math.min(exponential + Math.random() * BASE_DELAY_MS, MAX_DELAY_MS);
}

async function readErrorBody(res: Response) {
  try {
    const parsed = erpErrorBodySchema.safeParse(await res.json());
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

/** Map a non-2xx response to a storefront error. */
async function errorFor(res: Response, path: string, requestId: string): Promise<ErpError> {
  const body = await readErrorBody(res);
  const message = body.message ?? res.statusText;
  switch (true) {
    case res.status === 401 || res.status === 403:
      return new ErpConfigError(
        `ERP rejected the storefront credentials (${res.status}). Check ERP_API_KEY and ERP_TENANT.`,
        path,
        res.status,
        requestId,
      );
    case res.status === 404:
      return new ErpNotFoundError(path, requestId);
    case res.status === 409:
      return new ErpConflictError(message, path, requestId);
    case res.status === 422:
      return new ErpValidationError(message, body.errors ?? {}, path, requestId);
    case res.status === 429:
      return new ErpUnavailableError(path, "rate limited", 429, requestId);
    case res.status >= 500:
      return new ErpUnavailableError(
        path,
        `${res.status} ${res.statusText}`,
        res.status,
        requestId,
      );
    default:
      return new ErpResponseError(`${res.status} ${message}`, path, res.status, requestId);
  }
}

async function attemptOnce<S extends z.ZodType>(
  config: ErpConfig,
  req: ErpRequest<S>,
  requestId: string,
): Promise<{ data: z.infer<S> } | { error: ErpError; retryAfter: string | null }> {
  const method = req.method ?? "GET";
  let res: Response;
  try {
    res = await transport.fetch(buildUrl(config, req.path, req.query).toString(), {
      method,
      signal: AbortSignal.timeout(config.timeoutMs),
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "X-Request-Id": requestId,
        ...(req.body !== undefined && { "Content-Type": "application/json" }),
        ...(req.idempotencyKey && { "Idempotency-Key": req.idempotencyKey }),
      },
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
      // Caching is decided by the callers' `'use cache'` scopes, not by fetch.
      cache: "no-store",
    });
  } catch (error) {
    const reason =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
        ? `timed out after ${config.timeoutMs}ms`
        : "network error";
    return {
      error: new ErpUnavailableError(req.path, reason, 503, requestId),
      retryAfter: null,
    };
  }

  if (!res.ok) {
    return {
      error: await errorFor(res, req.path, requestId),
      retryAfter: res.headers.get("retry-after"),
    };
  }

  let json: unknown;
  try {
    json = res.status === 204 ? null : await res.json();
  } catch {
    return {
      error: new ErpResponseError("body is not valid JSON", req.path, res.status, requestId),
      retryAfter: null,
    };
  }
  const parsed = req.schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: new ErpResponseError(
        `${issue?.path.join(".") || "(root)"}: ${issue?.message ?? "invalid"}`,
        req.path,
        res.status,
        requestId,
      ),
      retryAfter: null,
    };
  }
  return { data: parsed.data };
}

/** Send a request to the ERP storefront API. Throws an ErpError subclass on failure. */
export async function erpRequest<S extends z.ZodType>(req: ErpRequest<S>): Promise<z.infer<S>> {
  const config = transport.config();
  if (!config) {
    throw new ErpConfigError(
      "ERP is not configured: set ERP_API_BASE_URL, ERP_API_KEY and ERP_TENANT.",
      req.path,
    );
  }
  const method = req.method ?? "GET";
  const maxRetries = method === "GET" || req.readOnly ? (req.retries ?? DEFAULT_RETRIES) : 0;
  const requestId = crypto.randomUUID();

  for (let attempt = 1; ; attempt++) {
    const started = performance.now();
    const result = await attemptOnce(config, req, requestId);
    const ms = Math.round(performance.now() - started);

    if ("data" in result) {
      transport.log(
        "info",
        `[erp] ${method} ${req.path} ok ${ms}ms attempt=${attempt} id=${requestId}`,
      );
      return result.data;
    }

    const { error } = result;
    const canRetry = isRetryable(error) && attempt <= maxRetries;
    transport.log(
      canRetry ? "warn" : "error",
      `[erp] ${method} ${req.path} ${error.name}(${error.status}) ${ms}ms attempt=${attempt} id=${requestId}` +
        (canRetry ? " retrying" : ` ${error.message}`),
    );
    if (!canRetry) throw error;
    await transport.sleep(backoffDelay(attempt, result.retryAfter));
  }
}

/** Shorthand for GET requests. */
export function erpGet<S extends z.ZodType>(
  path: string,
  schema: S,
  query?: ErpRequest<S>["query"],
): Promise<z.infer<S>> {
  return erpRequest({ path, schema, query });
}
