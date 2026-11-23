import type { CartItem } from "./store";

/** Opens a cake in the cart in Cake Studio, to change it; "Update cart" then replaces this line (BUN-184). */
export function editDesignHref(item: Pick<CartItem, "key" | "customization">): string | null {
  if (!item.customization) return null;
  const query = new URLSearchParams({ design: item.customization.designId, line: item.key });
  return `/cake-studio?${query}`;
}
