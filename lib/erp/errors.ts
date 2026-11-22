/**
 * Storefront error types for ERP failures. The HTTP client (lib/erp/http.ts)
 * turns every ERP failure into one of these, so features never deal with raw
 * HTTP statuses or fetch exceptions.
 *
 *   ErpError                 base class (status, path, requestId)
 *   ├─ ErpConfigError        ERP not configured, or the ERP rejected our credentials (401/403)
 *   ├─ ErpNotFoundError      404: the product/category/order doesn't exist
 *   ├─ ErpValidationError    422: the ERP refused the data (field messages in `fieldErrors`)
 *   ├─ ErpConflictError      409: e.g. stock changed or the order was already placed
 *   ├─ ErpUnavailableError   network error, timeout, 429 or 5xx: retried, then given up
 *   └─ ErpResponseError      the ERP answered, but not in the agreed shape
 *
 * `userMessage` is safe to show customers. `message` is for logs.
 */
export class ErpError extends Error {
  /** Short, customer-safe explanation. */
  readonly userMessage: string = "Something went wrong. Please try again.";

  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = "ErpError";
  }
}

export class ErpConfigError extends ErpError {
  override readonly userMessage = "The shop is temporarily unavailable. Please try again later.";
  constructor(message: string, path: string, status = 500, requestId?: string) {
    super(message, status, path, requestId);
    this.name = "ErpConfigError";
  }
}

export class ErpNotFoundError extends ErpError {
  override readonly userMessage = "We couldn't find that.";
  constructor(path: string, requestId?: string) {
    super("ERP resource not found", 404, path, requestId);
    this.name = "ErpNotFoundError";
  }
}

export class ErpValidationError extends ErpError {
  override readonly userMessage: string;
  constructor(
    message: string,
    /** Field name → messages, as sent by the ERP (Laravel `errors`). */
    readonly fieldErrors: Record<string, string[]>,
    path: string,
    requestId?: string,
  ) {
    super(`ERP validation failed: ${message}`, 422, path, requestId);
    this.name = "ErpValidationError";
    // Laravel validation messages are written for people, so they can be shown.
    this.userMessage = message || "Please check the details and try again.";
  }
}

export class ErpConflictError extends ErpError {
  override readonly userMessage: string;
  constructor(message: string, path: string, requestId?: string) {
    super(`ERP conflict: ${message}`, 409, path, requestId);
    this.name = "ErpConflictError";
    this.userMessage = message || "Something changed while you were shopping. Please try again.";
  }
}

export class ErpUnavailableError extends ErpError {
  override readonly userMessage =
    "We can't reach our shop system right now. Please try again in a moment.";
  constructor(path: string, cause: string, status = 503, requestId?: string) {
    super(`ERP unavailable (${cause})`, status, path, requestId);
    this.name = "ErpUnavailableError";
  }
}

export class ErpResponseError extends ErpError {
  constructor(message: string, path: string, status: number, requestId?: string) {
    super(`Unexpected ERP response: ${message}`, status, path, requestId);
    this.name = "ErpResponseError";
  }
}

/** True for errors worth retrying (the ERP may recover on its own). */
export function isRetryable(error: unknown): boolean {
  return error instanceof ErpUnavailableError;
}
