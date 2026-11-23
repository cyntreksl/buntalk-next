import { MAX_CART_LINES, MAX_QUANTITY } from "./limits";

/**
 * Combining carts (BUN-178). Pure, used on the server (sign-in) and in the
 * browser (a save that crossed another change). Lines are matched by key:
 * product, size and Cake Studio design.
 */

type Line = { key: string; quantity: number };

/**
 * Sign-in: the guest cart goes into the customer's saved cart. The same
 * product, size and design in both becomes one line with the quantities
 * added (at most 99; the ERP's own limits are applied by the next cart
 * check). The customer's lines keep their order, new guest lines follow.
 * Over 50 lines, the last ones are left out (`dropped`).
 */
export function mergeCarts<L extends Line>(
  saved: L[],
  guest: L[],
): { lines: L[]; dropped: number } {
  const byKey = new Map<string, L>();
  for (const line of saved) byKey.set(line.key, { ...line });
  for (const line of guest) {
    const existing = byKey.get(line.key);
    byKey.set(
      line.key,
      existing
        ? // The guest copy has the latest name and price; quantities are added up.
          {
            ...existing,
            ...line,
            quantity: Math.min(MAX_QUANTITY, existing.quantity + line.quantity),
          }
        : { ...line },
    );
  }
  const all = [...byKey.values()];
  return { lines: all.slice(0, MAX_CART_LINES), dropped: Math.max(0, all.length - MAX_CART_LINES) };
}

/**
 * A save from this browser crossed a newer saved cart (another device, or
 * the guest cart merged at sign-in): keep the saved cart, and add the lines
 * only this browser has. A line in both keeps the saved quantity, so nothing
 * is counted twice.
 */
export function unionCarts<L extends Line>(saved: L[], local: L[]): L[] {
  const keys = new Set(saved.map((l) => l.key));
  return [...saved, ...local.filter((l) => !keys.has(l.key))].slice(0, MAX_CART_LINES);
}
