import type { CartItem } from "./store";

/**
 * Browser calls to the cart API (app/api/cart/*). The server asks the ERP, so
 * hidden products are refused and every price comes from the ERP.
 */

type CartLine = Pick<CartItem, "productSlug" | "skuId" | "quantity">;

export type PricedLine = CartItem & {
  /** quantity × unit price, before offers (calculated on the server). */
  lineSubtotal: number;
  /** Scheme discount on this line (from the ERP). */
  discount: number;
  lineTotal: number;
  schemes: { id: string; name: string }[];
};

type AddResult =
  | { ok: true; item: PricedLine }
  | {
      ok: false;
      reason: "not_available" | "sold_out" | "choose_variant" | "error";
      message: string;
    };

const GENERIC = "Something went wrong. Please try again.";

const post = (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export async function checkItem(line: CartLine): Promise<AddResult> {
  try {
    const res = await post("/api/cart/items", line);
    const body = await res.json().catch(() => null);
    if (res.ok && body?.item) return { ok: true, item: body.item };
    const reason = ["not_available", "sold_out", "choose_variant"].includes(body?.error)
      ? body.error
      : "error";
    return { ok: false, reason, message: body?.message ?? GENERIC };
  } catch {
    return { ok: false, reason: "error", message: GENERIC };
  }
}

export type AppliedScheme = { id: string; name: string; description?: string; discount: number };
export type FreeItem = { name: string; variant?: string; quantity: number; schemeName: string };

export type ServerCart = {
  items: PricedLine[];
  removed: { key: string; reason: "not_available" | "sold_out" | "choose_variant" }[];
  appliedSchemes: AppliedScheme[];
  freeItems: FreeItem[];
  currency: string;
  subtotal: number;
  discountTotal: number;
  total: number;
};

/** Returns null if the check couldn't run (offline, ERP down). */
export async function validateCart(items: CartLine[]): Promise<ServerCart | null> {
  try {
    const res = await post("/api/cart/validate", {
      items: items.map(({ productSlug, skuId, quantity }) => ({ productSlug, skuId, quantity })),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}
