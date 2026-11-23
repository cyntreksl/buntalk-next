import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCustomerId } from "@/lib/auth";
import { cakeStudioErrorResponse, noStore } from "@/lib/cake-studio/api.server";
import { cakeLineFor } from "@/lib/cake-studio/cart.server";
import { cakeDesignSchema, getCakeStudioMenu, saveCakeDesign } from "@/lib/erp";

/**
 * Saves a Cake Studio design in the ERP and returns its id (BUN-179), so it
 * can be opened again later (`GET /api/cake-studio/designs/{id}`, or the
 * Cake Studio page with `?design={id}`).
 *
 *   POST /api/cake-studio/designs   { design: {…}, preview?: "data:image/png;base64,…", productSlug? }
 *   Idempotency-Key: <uuid>          optional; a retry with the same key saves once
 *   201 { id, design, lines, total, summary, earliestDate, createdAt, previewUrl, cartLine }
 *   cartLine (BUN-184): { productSlug, skuId } the cake is sold as (the Cake Studio product whose
 *   size is linked to the design's cake size; `productSlug` picks one when several are), or null
 *   422 invalid design · 400 not a design · 503 ERP unavailable
 */
/** A picture of the 3D preview (BUN-182): a PNG data URL, at most about 1.5 MB. */
const PREVIEW = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;
const bodySchema = z.object({
  design: cakeDesignSchema,
  preview: z.string().max(2_000_000).regex(PREVIEW).optional(),
  /** The Cake Studio product the designer was opened from, if any. */
  productSlug: z.string().max(200).optional(),
});
const keySchema = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/);

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", details: z.flattenError(parsed.error) },
      { status: 400, headers: noStore },
    );
  }
  const key = keySchema.safeParse(request.headers.get("idempotency-key"));
  try {
    const saved = await saveCakeDesign(parsed.data.design, {
      customerId: await getCustomerId(),
      idempotencyKey: `cake-design:${key.success ? key.data : randomUUID()}`,
      previewPng: parsed.data.preview?.match(PREVIEW)?.[1],
    });
    const cartLine = await cakeLineFor(
      await getCakeStudioMenu(),
      saved.design.size_id,
      parsed.data.productSlug,
    );
    return Response.json({ ...saved, cartLine }, { status: 201, headers: noStore });
  } catch (error) {
    return cakeStudioErrorResponse(error);
  }
}
