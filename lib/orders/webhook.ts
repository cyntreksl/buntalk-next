import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed ERP webhooks (BUN-165).
 *
 * The ERP signs the raw request body:
 *
 *   X-Erp-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with ERP_WEBHOOK_SECRET>
 *
 * The timestamp stops an old, captured request from being replayed: anything
 * more than 5 minutes away from the server's clock is refused.
 */

export const SIGNATURE_HEADER = "x-erp-signature";
const TOLERANCE_SECONDS = 5 * 60;

export function signPayload(secret: string, body: string, timestamp: number): string {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

export type SignatureCheck = { ok: true } | { ok: false; reason: string };

export function verifySignature(
  secret: string,
  body: string,
  header: string | null,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SignatureCheck {
  if (!header) return { ok: false, reason: "missing signature" };
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const i = part.indexOf("=");
      return [part.slice(0, i).trim(), part.slice(i + 1).trim()];
    }),
  );
  const timestamp = Number(parts.t);
  if (!Number.isInteger(timestamp) || !parts.v1)
    return { ok: false, reason: "malformed signature" };
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) {
    return { ok: false, reason: "timestamp too old or in the future" };
  }

  const expected = Buffer.from(signPayload(secret, body, timestamp).split("v1=")[1], "hex");
  const received = Buffer.from(parts.v1, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return { ok: false, reason: "signature mismatch" };
  }
  return { ok: true };
}
