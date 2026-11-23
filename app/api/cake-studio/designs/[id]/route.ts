import { getCustomerId } from "@/lib/auth";
import { cakeStudioErrorResponse, noStore } from "@/lib/cake-studio/api.server";
import { getCakeDesign } from "@/lib/erp";

/**
 * A saved Cake Studio design by its id (BUN-179), priced again with today's
 * menu and prices by the ERP.
 *
 *   GET /api/cake-studio/designs/{id}
 *   200 { id, design, lines, total, summary, earliestDate, createdAt }
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
    return Response.json(await getCakeDesign(id, { customerId: await getCustomerId() }), {
      headers: noStore,
    });
  } catch (error) {
    return cakeStudioErrorResponse(error);
  }
}
