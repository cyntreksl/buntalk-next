import { getDb } from "@/lib/db";
import { checkOpsAuth } from "@/lib/orders/ops-auth";
import { listSearchMisses } from "@/lib/search-misses";

/**
 * Searches that found nothing (BUN-172), most-searched first, so the team can
 * add products, names or spellings people look for.
 *
 *   GET /api/search/misses?days=30&limit=100
 *   Authorization: Bearer <ORDERS_OPS_SECRET>
 *
 *   200 { days, misses: [{ query, count, firstSeenAt, lastSeenAt }] }
 */
export async function GET(request: Request) {
  const denied = checkOpsAuth(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const days = clamp(Number(params.get("days") ?? 30), 1, 365);
  const limit = clamp(Number(params.get("limit") ?? 100), 1, 500);
  const misses = await listSearchMisses(await getDb(), { days, limit });
  return Response.json({ days, misses }, { headers: { "Cache-Control": "no-store" } });
}

const clamp = (n: number, min: number, max: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : min;
