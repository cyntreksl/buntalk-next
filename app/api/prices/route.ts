import { getCustomerId } from "@/lib/auth";
import { getProductsForCart } from "@/lib/erp";

/** At most one grid page of products per request. */
const MAX_SLUGS = 24;

export type PersonalPrices = {
  /** False when the visitor isn't a signed-in customer: show the normal prices. */
  personal: boolean;
  /** slug → that customer's price, and per size (SKU id). */
  prices: Record<string, { price: number; skus: Record<string, number> }>;
};

/**
 * The signed-in customer's own prices (customer group price level, BUN-174 /
 * ERP ticket BUN-247), so product cards and pages show "Your price".
 *
 *   GET /api/prices?slugs=fish-bun,sausage-bun
 *   200 { personal: true, prices: { "fish-bun": { price: 110, skus: {} } } }
 *   200 { personal: false, prices: {} }   not signed in (no ERP call)
 *
 * Live from the ERP (never cached, never shared). Hidden products are left
 * out. Pages stay cached with the online prices; this only adjusts them in
 * the customer's browser.
 */
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  const customerId = await getCustomerId();
  if (!customerId) return Response.json({ personal: false, prices: {} }, { headers });

  const slugs = [
    ...new Set(
      (new URL(request.url).searchParams.get("slugs") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^[a-z0-9-]{1,120}$/.test(s)),
    ),
  ].slice(0, MAX_SLUGS);
  if (slugs.length === 0) return Response.json({ personal: true, prices: {} }, { headers });

  try {
    const products = await getProductsForCart(slugs, { customerId });
    const prices: PersonalPrices["prices"] = {};
    for (const [slug, product] of products) {
      if (!product) continue;
      prices[slug] = {
        price: product.price,
        skus: Object.fromEntries((product.skus ?? []).map((s) => [s.id, s.price])),
      };
    }
    return Response.json({ personal: true, prices } satisfies PersonalPrices, { headers });
  } catch (error) {
    // The ERP is down: the page keeps showing the online prices; the cart re-checks anyway.
    console.error("[prices] Could not load customer prices.", error);
    return Response.json({ personal: false, prices: {} }, { headers });
  }
}
