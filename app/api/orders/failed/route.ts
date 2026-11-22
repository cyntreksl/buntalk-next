import { getDb } from "@/lib/db";
import { listProblemOrders } from "@/lib/orders";
import { checkOpsAuth } from "@/lib/orders/ops-auth";

/**
 * Orders the team should look at (BUN-164): failed or rejected ERP
 * submissions, and orders still not in the ERP after 10 minutes.
 *
 *   GET /api/orders/failed
 *   Authorization: Bearer <ORDERS_OPS_SECRET>
 *
 *   200 { orders: [{ number, erpStatus, attempts, lastError, nextAttemptAt, total, currency, createdAt }] }
 *
 * Alerts for the same problems also go to the server log ("[orders:alert]")
 * and to ALERT_WEBHOOK_URL when set.
 */
export async function GET(request: Request) {
  const denied = checkOpsAuth(request);
  if (denied) return denied;

  const orders = await listProblemOrders(await getDb());
  return Response.json({ orders }, { headers: { "Cache-Control": "no-store" } });
}
