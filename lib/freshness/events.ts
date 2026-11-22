import { z } from "zod";
import { cacheTags } from "@/lib/cache-tags";

/**
 * Catalog change events (BUN-167): what changed in the ERP, and which cached
 * pages that refreshes. Used by the signed revalidate webhook and the
 * scheduled catalog check. Pure: no I/O.
 *
 * Every product list (category pages, home rows, search, offers) carries the
 * `products` tag, so a product change refreshes the lists that show it too.
 * Product reads also carry `categories` (visibility depends on the category)
 * and `schemes` (offer badges).
 */

const slug = z.string().trim().min(1).max(200);

export const changeEventSchema = z.discriminatedUnion("type", [
  /** Price, text, image, visibility, featured, sizes … of one product. `previous_slug` when renamed. */
  z.object({ type: z.literal("product"), slug, previous_slug: slug.optional() }),
  /** Name, parent, order, image, visibility … of one category. */
  z.object({ type: z.literal("category"), slug, previous_slug: slug.optional() }),
  /** Home page merchandising (featured list). */
  z.object({ type: z.literal("home") }),
  /** Home page banners. */
  z.object({ type: z.literal("banners") }),
  /** A scheme / offer was added, changed or ended. */
  z.object({ type: z.literal("schemes") }),
  /** Bulk changes (imports, price lists): refresh the whole catalog. */
  z.object({ type: z.literal("all") }),
]);

export type ChangeEvent = z.infer<typeof changeEventSchema>;

/** One event, or several at once: { "events": [ … ] } (up to 200). */
export const changeRequestSchema = z.union([
  changeEventSchema.transform((e) => [e]),
  z.object({ events: z.array(changeEventSchema).min(1).max(200) }).transform((b) => b.events),
]);

export function tagsForEvent(event: ChangeEvent): string[] {
  switch (event.type) {
    case "product":
      return [
        cacheTags.product(event.slug),
        ...(event.previous_slug ? [cacheTags.product(event.previous_slug)] : []),
        cacheTags.products,
      ];
    case "category":
      return [
        cacheTags.category(event.slug),
        ...(event.previous_slug ? [cacheTags.category(event.previous_slug)] : []),
        cacheTags.categories,
      ];
    case "home":
      return [cacheTags.home];
    case "banners":
      return [cacheTags.banners, cacheTags.home];
    case "schemes":
      return [cacheTags.schemes];
    case "all":
      return [cacheTags.catalog];
  }
}

/** All tags for a batch, without duplicates. `all` makes every other tag unnecessary. */
export function tagsForEvents(events: ChangeEvent[]): string[] {
  if (events.some((e) => e.type === "all")) return [cacheTags.catalog];
  return [...new Set(events.flatMap(tagsForEvent))];
}
