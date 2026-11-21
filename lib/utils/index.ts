/** Join class names, skipping falsy values. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Format a price for display, e.g. "LKR 1,200.00". */
export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency }).format(amount);
}
