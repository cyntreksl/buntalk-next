import { retryCustomerSync } from "@/lib/customers";
import { getDb } from "@/lib/db";
import { checkCatalog } from "@/lib/freshness/check";
import { pollOrderStatuses, retryDueSubmissions } from "@/lib/orders";
import { checkOpsAuth } from "@/lib/orders/ops-auth";

/**
 * The storefront's background jobs, in one request. Schedule it every
 * minute (any cron: the hosting platform's, GitHub Actions, a system cron):
 *
 *   curl -X POST -H "Authorization: Bearer $ORDERS_OPS_SECRET" https://<site>/api/cron
 *
 * Each job keeps its own pace, so running this every minute is safe:
 * - orders:    send due orders to the ERP (retry queue, BUN-164)
 * - statuses:  poll open orders' status not checked for 5 minutes (BUN-165)
 * - customers: send due customer changes to the ERP (BUN-166)
 * - catalog:   every 5 minutes, find catalog changes a missed webhook didn't
 *              report and refresh those pages (BUN-167)
 *
 * One failing job doesn't stop the others; its error is in the response
 * and the server log.
 *
 * Body (optional): { "force": ["catalog"] } runs the catalog check now
 * instead of waiting for its 5-minute slot (e.g. after a bulk ERP change).
 */

async function run<T>(name: string, job: () => Promise<T>) {
  try {
    return await job();
  } catch (error) {
    console.error(`[cron] ${name} failed`, error);
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function POST(request: Request) {
  const denied = checkOpsAuth(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { force?: unknown };
  const force = Array.isArray(body?.force) ? body.force : [];

  const db = await getDb();
  const orders = await run("orders", () => retryDueSubmissions(db));
  const statuses = await run("statuses", () => pollOrderStatuses(db));
  const customers = await run("customers", () => retryCustomerSync(db));
  const catalog = await run("catalog", () =>
    checkCatalog(db, { force: force.includes("catalog") }),
  );

  return Response.json(
    { orders, statuses, customers, catalog },
    { headers: { "Cache-Control": "no-store" } },
  );
}
