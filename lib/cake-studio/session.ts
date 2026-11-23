import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Cake Studio embed session (BUN-180, ERP ticket BUN-261). The storefront
 * signs it; the ERP's embed page checks it before it renders, and only talks
 * to `origin`. Token: base64url(JSON payload) + "." + base64url(HMAC-SHA256).
 *
 * Server only (uses the shared secret). The mock ERP checks it the same way.
 */

export const SESSION_MINUTES = 30;

export const embedSessionSchema = z.object({
  v: z.literal(1),
  /** The storefront origin, e.g. "https://buntalk.lk": the only page the embed talks to. */
  origin: z.url(),
  /** Expiry, Unix seconds. */
  exp: z.number().int(),
  /** ERP customer link_id (B2B price levels), once sign-in exists. */
  customer: z.string().optional(),
  /** Open with this cake chosen. */
  preselect: z
    .object({
      product_id: z.string().optional(),
      sku_id: z.string().optional(),
      size_id: z.number().int().optional(),
    })
    .optional(),
});
export type EmbedSession = z.infer<typeof embedSessionSchema>;

const b64 = (data: string | Buffer) => Buffer.from(data).toString("base64url");
const sign = (payload: string, secret: string) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export function signEmbedSession(session: EmbedSession, secret: string): string {
  const payload = b64(JSON.stringify(embedSessionSchema.parse(session)));
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * The session in a token, or why it's refused: "malformed", "bad_signature",
 * "expired". (The ERP also refuses an origin not on its framing list.)
 */
export function verifyEmbedSession(
  token: string,
  secret: string,
  now: number = Date.now(),
):
  | { ok: true; session: EmbedSession }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" } {
  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return { ok: false, reason: "malformed" };
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false, reason: "bad_signature" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const session = embedSessionSchema.safeParse(parsed);
  if (!session.success) return { ok: false, reason: "malformed" };
  if (session.data.exp * 1000 <= now) return { ok: false, reason: "expired" };
  return { ok: true, session: session.data };
}
