import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { cacheTags } from "@/lib/cache-tags";
import { serverEnv } from "@/lib/env.server";

/**
 * On-demand revalidation webhook, called by the ERP when catalog data changes.
 *
 *   POST /api/revalidate
 *   Authorization: Bearer <REVALIDATE_SECRET>
 *   Content-Type: application/json
 *
 *   { "type": "product",  "slug": "<product slug>" }   one product changed (price, text, …)
 *   { "type": "category", "slug": "<category slug>" }  one category changed
 *   { "type": "home" }                                  home page merchandising changed
 *   { "type": "schemes" }                               a scheme / offer was added, changed or ended
 *   { "type": "all" }                                   refresh the whole catalog
 *
 * Pages keep serving the old version until the fresh one is ready
 * (stale-while-revalidate), so visitors never wait for the refresh.
 */

const bodySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("product"), slug: z.string().min(1) }),
  z.object({ type: z.literal("category"), slug: z.string().min(1) }),
  z.object({ type: z.literal("home") }),
  z.object({ type: z.literal("schemes") }),
  z.object({ type: z.literal("all") }),
]);

type RevalidateRequest = z.infer<typeof bodySchema>;

function tagsFor(request: RevalidateRequest): string[] {
  switch (request.type) {
    case "product":
      // Product lists (category pages, home, search) show the product too.
      return [cacheTags.product(request.slug), cacheTags.products];
    case "category":
      return [cacheTags.category(request.slug), cacheTags.categories];
    case "home":
      return [cacheTags.home];
    case "schemes":
      // Offer badges on every product list and product page.
      return [cacheTags.schemes];
    case "all":
      return [cacheTags.catalog];
  }
}

function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(request: Request) {
  const secret = serverEnv().REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ error: "Revalidation is not configured" }, { status: 503 });
  }
  if (!isAuthorized(request, secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid body", details: z.flattenError(parsed.error) },
      { status: 400 },
    );
  }

  const tags = tagsFor(parsed.data);
  for (const tag of tags) revalidateTag(tag, "max");

  return Response.json({ revalidated: tags });
}
