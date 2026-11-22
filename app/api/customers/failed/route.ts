import { listCustomerSyncProblems } from "@/lib/customers";
import { getDb } from "@/lib/db";
import { checkOpsAuth } from "@/lib/orders/ops-auth";

/**
 * Customers the team should look at (BUN-166): ERP conflicts (phone or email
 * belongs to another ERP customer, or two accounts for one ERP customer),
 * failed syncs, and customers not in the ERP after 10 minutes.
 *
 *   GET /api/customers/failed
 *   Authorization: Bearer <ORDERS_OPS_SECRET>
 *
 *   200 { customers: [{ id, name, phone, syncStatus, syncAttempts, lastSyncError, erpCustomerId, updatedAt }] }
 */
export async function GET(request: Request) {
  const denied = checkOpsAuth(request);
  if (denied) return denied;

  const customers = await listCustomerSyncProblems(await getDb());
  return Response.json({ customers }, { headers: { "Cache-Control": "no-store" } });
}
