import { z } from "zod";
import { retryCustomerSync } from "@/lib/customers";
import { getDb } from "@/lib/db";
import { pollOrderStatuses, requeueOrder, retryDueSubmissions } from "@/lib/orders";
import { checkOpsAuth } from "@/lib/orders/ops-auth";

/**
 * The ERP submission retry queue (BUN-164).
 *
 *   POST /api/orders/retry
 *   Authorization: Bearer <ORDERS_OPS_SECRET>
 *
 *   {}                        send every order whose retry is due (run this every minute)
 *   { "number": "BT-…" }      put one failed/rejected order back in the queue and send it now
 *
 *   200 { summary: { submitted, failed, rejected, skipped }, statuses: { checked, changed, errors },
 *         customers: { synced, failed, conflict, skipped } }
 *
 * Each run also polls the ERP for the status of open orders not checked in
 * the last 5 minutes (fallback for missed status webhooks, BUN-165), and sends
 * customer profile changes that are due to the ERP (BUN-166).
 *
 * Schedule it with any cron (hosting cron, GitHub Actions, a system cron):
 *   curl -X POST -H "Authorization: Bearer $ORDERS_OPS_SECRET" https://<site>/api/orders/retry
 */
const bodySchema = z.object({ number: z.string().min(1).optional() }).default({});

export async function POST(request: Request) {
  const denied = checkOpsAuth(request);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "invalid_body" }, { status: 400 });

  const db = await getDb();
  if (parsed.data.number) {
    const id = await requeueOrder(db, parsed.data.number);
    if (!id) {
      return Response.json(
        { error: "not_found", message: "No failed or rejected order with that number." },
        { status: 404 },
      );
    }
  }
  const summary = await retryDueSubmissions(db);
  const statuses = await pollOrderStatuses(db);
  const customers = await retryCustomerSync(db);
  return Response.json(
    { summary, statuses, customers },
    { headers: { "Cache-Control": "no-store" } },
  );
}
