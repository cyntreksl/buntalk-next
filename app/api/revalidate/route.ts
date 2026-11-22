import { revalidateTag } from "next/cache";
import { z } from "zod";
import { serverEnv } from "@/lib/env.server";
import { changeRequestSchema, tagsForEvents } from "@/lib/freshness/events";
import { readSignedErpWebhook } from "@/lib/webhooks/signature";

/**
 * On-demand revalidation webhook, called by the ERP when catalog data
 * changes (BUN-160, signed since BUN-167).
 *
 *   POST /api/revalidate
 *   X-Erp-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>" with ERP_WEBHOOK_SECRET>
 *   Content-Type: application/json
 *
 *   { "type": "product",  "slug": "<slug>", "previous_slug": "<old slug>"? }   price, text, visibility …
 *   { "type": "category", "slug": "<slug>", "previous_slug": "<old slug>"? }   name, order, visibility …
 *   { "type": "home" }        featured products
 *   { "type": "banners" }     home page banners
 *   { "type": "schemes" }     a scheme / offer was added, changed or ended
 *   { "type": "all" }         bulk changes: refresh the whole catalog
 *   { "events": [ …up to 200 of the above… ] }                              several at once
 *
 *   200 { revalidated: [tags] } · 401 unsigned, bad or old signature · 400 invalid body · 503 not configured
 *
 * Unsigned requests are rejected; a captured request can't be replayed after
 * 5 minutes. Refreshing is idempotent, so the ERP may retry freely. Pages
 * keep serving the old version until the fresh one is ready
 * (stale-while-revalidate), so visitors never wait. If a webhook is missed,
 * the scheduled catalog check (lib/freshness/check.ts) catches the change
 * within 5 minutes.
 */
export async function POST(request: Request) {
  const signed = await readSignedErpWebhook(request, serverEnv().ERP_WEBHOOK_SECRET, "revalidate");
  if (!signed.ok) return signed.response;

  let json: unknown;
  try {
    json = JSON.parse(signed.body);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = changeRequestSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid body", details: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }

  const tags = tagsForEvents(parsed.data);
  for (const tag of tags) revalidateTag(tag, "max");
  console.info(`[freshness] webhook revalidated ${tags.join(", ")}`);
  return Response.json({ revalidated: tags }, { headers: { "Cache-Control": "no-store" } });
}
