import { formatPrice } from "@/lib/utils";

/**
 * Price changes found when the server re-prices the cart (BUN-177): the ERP
 * price of a line is different from the one the cart showed (the price was
 * changed in the ERP, an old cart from an earlier visit, or the customer's
 * own price after signing in). The cart then says so, so the total never
 * changes without a reason the customer can see.
 */
export type PriceChange = { key: string; name: string; from: number; to: number };

type Line = { key: string; name: string; variant?: string; unitPrice: number };

export function priceChanges(shown: Line[], priced: { key: string; unitPrice: number }[]) {
  const now = new Map(priced.map((p) => [p.key, p.unitPrice]));
  const changes: PriceChange[] = [];
  for (const line of shown) {
    const to = now.get(line.key);
    // A line never priced before (0) isn't a change.
    if (to === undefined || line.unitPrice <= 0 || Math.abs(to - line.unitPrice) < 0.005) continue;
    const name = line.variant ? `${line.name} (${line.variant})` : line.name;
    changes.push({ key: line.key, name, from: line.unitPrice, to });
  }
  return changes;
}

/** "The price of Fish bun changed from LKR 120.00 to LKR 110.00." */
export function priceChangeText(changes: PriceChange[], currency: string): string | null {
  if (changes.length === 0) return null;
  if (changes.length === 1) {
    const [c] = changes;
    return `The price of ${c.name} changed from ${formatPrice(c.from, currency)} to ${formatPrice(c.to, currency)}.`;
  }
  const list = changes.map((c) => `${c.name} (now ${formatPrice(c.to, currency)})`);
  return `Prices changed for ${list.slice(0, -1).join(", ")} and ${list.at(-1)}.`;
}
