import "server-only";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { CakeStudioMenu, Product } from "@/lib/erp";
import { SESSION_MINUTES, signEmbedSession } from "./session";

/**
 * The ERP's Cake Studio embed (BUN-180, ERP ticket BUN-261): where it is and
 * how to open it. Null when it isn't set up (no CAKE_STUDIO_EMBED_URL or
 * secret): the Cake Studio page then shows the menu only.
 */
export function cakeStudioEmbedConfig() {
  const { CAKE_STUDIO_EMBED_URL, CAKE_STUDIO_EMBED_SECRET } = serverEnv();
  if (!CAKE_STUDIO_EMBED_URL || !CAKE_STUDIO_EMBED_SECRET) return null;
  return {
    url: CAKE_STUDIO_EMBED_URL,
    /** The only origin the storefront accepts messages from and sends them to. */
    origin: new URL(CAKE_STUDIO_EMBED_URL).origin,
    secret: CAKE_STUDIO_EMBED_SECRET,
  };
}

export type Preselect = { productId?: string; skuId?: string; sizeId?: number };

/**
 * The embed address with a freshly signed session (valid 30 minutes). Call
 * at request time (it reads the clock).
 */
export function cakeStudioEmbedSrc(options: { preselect?: Preselect; customerId?: string | null }) {
  const config = cakeStudioEmbedConfig();
  if (!config) return null;
  const { preselect, customerId } = options;
  const token = signEmbedSession(
    {
      v: 1,
      origin: new URL(publicEnv.NEXT_PUBLIC_SITE_URL).origin,
      exp: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
      ...(customerId ? { customer: customerId } : {}),
      ...(preselect
        ? {
            preselect: {
              product_id: preselect.productId,
              sku_id: preselect.skuId,
              size_id: preselect.sizeId,
            },
          }
        : {}),
    },
    config.secret,
  );
  const url = new URL(config.url);
  url.searchParams.set("session", token);
  return { src: url.toString(), origin: config.origin };
}

/**
 * The Cake Studio size to start with for a product: the size linked to one of
 * the product's sizes (SKUs) in the ERP, the default size first.
 */
export function sizeForProduct(
  menu: Pick<CakeStudioMenu, "sizes"> | null,
  product: Pick<Product, "skus">,
  skuId?: string,
): number | undefined {
  if (!menu) return undefined;
  const skuIds = [skuId, ...(product.skus ?? []).map((s) => s.id)].filter(Boolean);
  for (const id of skuIds) {
    const size = menu.sizes.find((s) => s.skuLinkId === id);
    if (size) return size.id;
  }
  return undefined;
}
