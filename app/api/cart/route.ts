import { z } from "zod";
import { getUserId } from "@/lib/auth";
import { ensureCartTokenHash, readCartTokenHash } from "@/lib/cart/cookie.server";
import { MAX_CART_LINES } from "@/lib/cart/limits";
import { loadCart, normalizeLines, saveCart, savedLineSchema } from "@/lib/cart/persist.server";
import { getDb } from "@/lib/db";

/**
 * The visitor's saved cart (BUN-175).
 *
 *   GET /api/cart
 *   200 { items: [{ key, productSlug, skuId, name, variant, customization, unitPrice, quantity }], updatedAt }
 *
 *   PUT /api/cart   { items: [...], baseUpdatedAt }   replaces the saved cart
 *   200 { items, updatedAt }           cleaned: merged lines, 1–99 each, at most 50 lines
 *   409 { error: "conflict", items, updatedAt }   the saved cart changed since
 *       baseUpdatedAt (sign-in merge, another device): combine and save again
 *
 * A guest's cart is found by the random token in the httpOnly `buntalk_cart`
 * cookie (set on the first save). Once sign-in exists, a signed-in customer's
 * cart is saved against the customer instead, so it follows them to other
 * devices. At sign-in the guest cart is merged into it (BUN-178,
 * lib/cart/signin.server.ts).
 *
 * This only stores the cart. Lines are checked with the ERP when they're
 * added (POST /api/cart/items) and when the cart opens (POST /api/cart/validate).
 */
const headers = { "Cache-Control": "private, no-store" };

const response = (cart: { lines: unknown[]; updatedAt: Date } | null) =>
  Response.json(
    { items: cart?.lines ?? [], updatedAt: cart?.updatedAt.toISOString() ?? null },
    { headers },
  );

export async function GET() {
  const customerId = await getUserId();
  const tokenHash = customerId ? null : await readCartTokenHash();
  if (!customerId && !tokenHash) return response(null);
  return response(await loadCart(await getDb(), { customerId, tokenHash }));
}

const bodySchema = z.object({
  items: z.array(savedLineSchema).max(MAX_CART_LINES * 2),
  /**
   * The saved cart's `updatedAt` this browser last saw (null: never). When the
   * saved cart has changed since, the save is refused with 409 and the current
   * saved cart, so nothing is overwritten (BUN-178). Leave it out to always save.
   */
  baseUpdatedAt: z.iso.datetime().nullable().optional(),
});

export async function PUT(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", details: z.flattenError(parsed.error) },
      { status: 400, headers },
    );
  }
  const lines = normalizeLines(parsed.data.items);
  const customerId = await getUserId();
  // Don't start a saved cart (or set a cookie) just to save an empty one.
  if (!customerId && lines.length === 0 && !(await readCartTokenHash())) return response(null);
  const tokenHash = customerId ? null : await ensureCartTokenHash();
  const { baseUpdatedAt } = parsed.data;
  const saved = await saveCart(await getDb(), { customerId, tokenHash }, lines, {
    baseUpdatedAt:
      baseUpdatedAt === undefined ? undefined : baseUpdatedAt ? new Date(baseUpdatedAt) : null,
  });
  if (saved.conflict) {
    return Response.json(
      { error: "conflict", items: saved.lines, updatedAt: saved.updatedAt.toISOString() },
      { status: 409, headers },
    );
  }
  return response(saved);
}
