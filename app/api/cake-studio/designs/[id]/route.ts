import { getCustomerId } from "@/lib/auth";
import { cakeStudioErrorResponse, noStore } from "@/lib/cake-studio/api.server";
import { cakeLineFor } from "@/lib/cake-studio/cart.server";
import { getCakeDesign, getCakeStudioMenu } from "@/lib/erp";

/**
 * A saved Cake Studio design by its id (BUN-179), priced again with today's
 * menu and prices by the ERP.
 *
 *   GET /api/cake-studio/designs/{id}
 *   200 { id, design, lines, total, summary, earliestDate, createdAt, previewUrl, cartLine }
 *   cartLine: { productSlug, skuId } the cake is sold as (BUN-184), or null if its size isn't sold online
 *   404 unknown id · 422 an option in it is no longer on the menu · 503 ERP unavailable
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/cake-studio/designs/[id]">,
) {
  const { id } = await params;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) {
    return Response.json(
      { error: "not_found", message: "We couldn't find that cake design." },
      { status: 404, headers: noStore },
    );
  }
  try {
    const saved = await getCakeDesign(id, { customerId: await getCustomerId() });
    const cartLine = await cakeLineFor(await getCakeStudioMenu(), saved.design.size_id);
    return Response.json({ ...saved, cartLine }, { headers: noStore });
  } catch (error) {
    return cakeStudioErrorResponse(error);
  }
}
