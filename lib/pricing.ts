/** Price helpers usable on the server and in the browser. */

type Priced = { price: number; compareAtPrice?: number };

/** True when an item is on offer (has a higher original price). */
export function isOnOffer(item: Priced): item is Priced & { compareAtPrice: number } {
  return item.compareAtPrice !== undefined && item.compareAtPrice > item.price;
}

/** Whole-number percentage saved, e.g. 20 for 1500 → 1200. */
export function discountPercent(item: Priced): number {
  if (!isOnOffer(item)) return 0;
  return Math.round(((item.compareAtPrice - item.price) / item.compareAtPrice) * 100);
}
