import type { CartItem } from "./store";

/**
 * Browser calls to the cart check API (app/api/cart/*). The server asks the
 * ERP, so hidden products are refused and prices come from the ERP.
 */

type AddResult =
  { ok: true; item: CartItem } | { ok: false; reason: "not_available" | "error"; message: string };

const GENERIC = "Something went wrong. Please try again.";

export async function checkItem(sku: string, quantity: number): Promise<AddResult> {
  try {
    const res = await fetch("/api/cart/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sku, quantity }),
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.item) return { ok: true, item: body.item };
    return {
      ok: false,
      reason: res.status === 404 ? "not_available" : "error",
      message: body?.message ?? GENERIC,
    };
  } catch {
    return { ok: false, reason: "error", message: GENERIC };
  }
}

export type CartValidation = { items: CartItem[]; removed: { sku: string }[] };

/** Returns null if the check couldn't run (offline, ERP down): the cart is then left as is. */
export async function validateCart(
  items: Pick<CartItem, "sku" | "quantity">[],
): Promise<CartValidation | null> {
  try {
    const res = await fetch("/api/cart/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map(({ sku, quantity }) => ({ sku, quantity })) }),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
