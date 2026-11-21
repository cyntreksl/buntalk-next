"use client";

import { useCartStore, type CartItem } from "./store";

/**
 * Client island on a cached product page. The page HTML is shared by all
 * visitors; the cart itself lives only in this visitor's browser.
 */
export function AddToCartButton({ item }: { item: Omit<CartItem, "quantity"> }) {
  const addItem = useCartStore((state) => state.addItem);
  return (
    <button
      type="button"
      onClick={() => addItem(item)}
      className="bg-foreground text-background rounded-md px-4 py-2 hover:opacity-90"
    >
      Add to cart
    </button>
  );
}
