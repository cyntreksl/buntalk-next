import "server-only";
import { ErpError, ErpNotFoundError, ErpValidationError } from "@/lib/erp";

const headers = { "Cache-Control": "private, no-store" };

/**
 * JSON error for the Cake Studio API routes (BUN-179):
 * - 404 unknown design id;
 * - 422 the ERP refused the design (field → message, e.g. "Choose a sponge.");
 * - 503 the ERP is unreachable, with a customer-safe message.
 */
export function cakeStudioErrorResponse(error: unknown): Response {
  if (error instanceof ErpNotFoundError) {
    return Response.json(
      { error: "not_found", message: "We couldn't find that cake design." },
      { status: 404, headers },
    );
  }
  if (error instanceof ErpValidationError) {
    const fieldErrors = Object.fromEntries(
      Object.entries(error.fieldErrors).map(([field, messages]) => [field, messages[0] ?? ""]),
    );
    return Response.json(
      { error: "invalid_design", message: error.userMessage, fieldErrors },
      { status: 422, headers },
    );
  }
  if (error instanceof ErpError) {
    console.error("[cake-studio] ERP request failed", error);
    return Response.json(
      { error: "unavailable", message: error.userMessage },
      { status: 503, headers },
    );
  }
  throw error;
}

export const noStore = headers;
