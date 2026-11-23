import { z } from "zod";
import { getCustomerId } from "@/lib/auth";
import { cakeStudioErrorResponse, noStore } from "@/lib/cake-studio/api.server";
import { cakeDesignSchema, quoteCakeDesign } from "@/lib/erp";

/**
 * Prices a Cake Studio design (BUN-179). The ERP checks the picks against
 * its menu and prices them; nothing is calculated here, and any price the
 * browser sends is ignored.
 *
 *   POST /api/cake-studio/quote   { design: { size_id, shape_id, sponge_id, … } }
 *   200 { design, lines: [{ label, price }], total, summary: [{ label, value }], earliestDate }
 *   422 { error: "invalid_design", message, fieldErrors: { sponge_id: "Choose a sponge." } }
 *   400 not a design · 503 ERP unavailable
 */
const bodySchema = z.object({ design: cakeDesignSchema });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", details: z.flattenError(parsed.error) },
      { status: 400, headers: noStore },
    );
  }
  try {
    const quote = await quoteCakeDesign(parsed.data.design, { customerId: await getCustomerId() });
    return Response.json(quote, { headers: noStore });
  } catch (error) {
    return cakeStudioErrorResponse(error);
  }
}
