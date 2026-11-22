/** Join class names, skipping falsy values. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Format a price for display, e.g. "LKR 1,200.00". */
export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency }).format(amount);
}

/** A price split for styling: { currency: "LKR", amount: "1,200.00" }. */
export function priceParts(amount: number, currency: string): { currency: string; amount: string } {
  const parts = new Intl.NumberFormat("en-LK", { style: "currency", currency }).formatToParts(
    amount,
  );
  return {
    currency: parts.find((p) => p.type === "currency")?.value ?? currency,
    amount: parts
      .filter((p) => p.type !== "currency" && p.type !== "literal")
      .map((p) => p.value)
      .join(""),
  };
}

/** Weight for display: 1500 → "1.5 kg", 250 → "250 g". */
export function formatWeight(grams: number): string {
  return grams >= 1000 ? `${Number((grams / 1000).toFixed(2))} kg` : `${Math.round(grams)} g`;
}
