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
      className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-5 py-2.5 font-bold"
    >
      Add to cart
    </button>
  );
}
