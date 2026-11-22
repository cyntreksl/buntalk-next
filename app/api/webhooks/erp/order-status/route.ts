import { z } from "zod";
import { getDb } from "@/lib/db";
import { serverEnv } from "@/lib/env.server";
import { applyStatus, findOrderForErp, isErpOrderStatus } from "@/lib/orders";
import { SIGNATURE_HEADER, verifySignature } from "@/lib/orders/webhook";

/**
 * Order status webhook from the ERP (BUN-165).
 *
 *   POST /api/webhooks/erp/order-status
 *   X-Erp-Signature: t=<unix seconds>,v1=<HMAC-SHA256 hex>     (see lib/orders/webhook.ts)
 *
 *   {
 *     "event": "order.status_changed",
 *     "data": {
 *       "link_id": "<ERP order id>", "number": "WEB-1001",
 *       "storefront_order_number": "BT-261122-7K3QX",
 *       "status": "preparing", "changed_at": "2026-11-22T10:15:00Z"
 *     }
 *   }
 *
 *   200 { applied: true|false }   applied=false: older or repeated update, ignored
 *   202 { ignored: "unknown order" }   not a storefront order (e.g. a POS order)
 *   401 bad or old signature · 400 invalid body · 503 not configured
 *
 * Safe to deliver more than once or out of order: older updates never
 * overwrite a newer status.
 */

const bodySchema = z.object({
  event: z.literal("order.status_changed"),
  data: z.object({
    link_id: z.string().min(1),
    number: z.string().optional(),
    storefront_order_number: z.string().optional(),
    status: z.string().refine(isErpOrderStatus, "unknown status"),
    changed_at: z.iso.datetime({ offset: true }),
  }),
});

export async function POST(request: Request) {
  const secret = serverEnv().ERP_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Order webhooks are not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const check = verifySignature(secret, raw, request.headers.get(SIGNATURE_HEADER));
  if (!check.ok) {
    console.warn(`[orders] webhook refused: ${check.reason}`);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", details: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }

  const { data } = parsed.data;
  const db = await getDb();
  const order = await findOrderForErp(db, {
    erpOrderId: data.link_id,
    storefrontOrderNumber: data.storefront_order_number,
  });
  if (!order) return Response.json({ ignored: "unknown order" }, { status: 202 });

  const applied = await applyStatus(db, order, {
    status: data.status as Parameters<typeof applyStatus>[2]["status"],
    changedAt: new Date(data.changed_at),
    source: "webhook",
  });
  return Response.json({ applied }, { headers: { "Cache-Control": "no-store" } });
}
