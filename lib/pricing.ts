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

type WithVariants = Priced & {
  skus?: (Priced & { options: { type: string; value: string }[] })[];
};

/**
 * The price to show for a product in lists. A product whose sizes/variants
 * have different prices shows its lowest price as "From …". All prices come
 * from the ERP; nothing here calculates a price, it only picks one.
 */
export function listingPrice(product: WithVariants): Priced & { from: boolean } {
  const skus = product.skus ?? [];
  if (skus.length === 0) return { ...product, from: false };
  const cheapest = skus.reduce((min, s) => (s.price < min.price ? s : min));
  const varies = skus.some((s) => s.price !== cheapest.price);
  return { price: cheapest.price, compareAtPrice: cheapest.compareAtPrice, from: varies };
}

/** "1 kg", or "1 kg / Chocolate" for a SKU with several options. */
export function variantLabel(options: { type: string; value: string }[]): string {
  return options.map((o) => o.value).join(" / ");
}

/** Money is added in cents, so totals never pick up floating-point dust (0.1 + 0.2). */
export function lineTotal(unitPrice: number, quantity: number): number {
  return Math.round(unitPrice * 100 * quantity) / 100;
}

export function sumMoney(amounts: number[]): number {
  return amounts.reduce((sum, a) => sum + Math.round(a * 100), 0) / 100;
}

/** The size a product page starts with: the first one in stock, else the first. */
export function defaultSkuId(
  skus: { id: string; inStock: boolean }[] | undefined,
): string | undefined {
  return (skus?.find((s) => s.inStock) ?? skus?.[0])?.id;
}
