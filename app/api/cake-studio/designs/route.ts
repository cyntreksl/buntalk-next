import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getCustomerId } from "@/lib/auth";
import { cakeStudioErrorResponse, noStore } from "@/lib/cake-studio/api.server";
import { cakeDesignSchema, saveCakeDesign } from "@/lib/erp";

/**
 * Saves a Cake Studio design in the ERP and returns its id (BUN-179), so it
 * can be opened again later (`GET /api/cake-studio/designs/{id}`, or the
 * Cake Studio page with `?design={id}`).
 *
 *   POST /api/cake-studio/designs   { design: {…} }
 *   Idempotency-Key: <uuid>          optional; a retry with the same key saves once
 *   201 { id, design, lines, total, summary, earliestDate, createdAt }
 *   422 invalid design · 400 not a design · 503 ERP unavailable
 */
const bodySchema = z.object({ design: cakeDesignSchema });
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
    });
    return Response.json(saved, { status: 201, headers: noStore });
  } catch (error) {
    return cakeStudioErrorResponse(error);
  }
}
