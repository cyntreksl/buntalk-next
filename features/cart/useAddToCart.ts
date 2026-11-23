"use client";

import { useState } from "react";
import { toast } from "@/components/ui";
import { lineKey } from "@/lib/cart/limits";
import { checkItem } from "./api";
import { useMiniCart } from "./miniCart";
import { useCartStore, type CartItem } from "./store";

const failureTitles = {
  not_available: "Not available",
  sold_out: "Sold out",
  choose_variant: "Choose a size",
  customize_first: "Design it first",
  error: "Couldn't add to cart",
} as const;

/**
 * Adds a product (and size, or Cake Studio design) to the cart. The server
 * checks it with the ERP first and returns the price, and the line's total
 * quantity kept within its limits (BUN-175); nothing here calculates a price.
 * Opens the mini-cart drawer when it's added (with a note if the quantity was
 * limited), or shows an error toast. Used by the product page and product cards.
 */
export function useAddToCart() {
  const setLine = useCartStore((state) => state.setLine);
  const [adding, setAdding] = useState(false);

  async function add(line: {
    productSlug: string;
    skuId?: string;
    quantity: number;
    customization?: CartItem["customization"];
  }) {
    // Already in the cart, so the server can keep the total within the limits.
    const key = lineKey(line.productSlug, line.skuId, line.customization?.designId);
    const inCart = useCartStore.getState().items.find((i) => i.key === key)?.quantity ?? 0;

    setAdding(true);
    const result = await checkItem({ ...line, inCart });
    setAdding(false);

    if (!result.ok) {
      toast.error(failureTitles[result.reason], result.message);
      return false;
    }
    const {
      key: checkedKey,
      productSlug,
      skuId,
      name,
      variant,
      customization,
      imageUrl,
      unitPrice,
    } = result.item;
    const total = result.item.quantity;
    setLine({
      key: checkedKey,
      productSlug,
      skuId,
      name,
      variant,
      customization,
      imageUrl,
      unitPrice,
      quantity: total,
    });

    const label = `${name}${variant ? ` (${variant})` : ""}`;
    if (result.item.adjusted) {
      const added = Math.max(0, total - inCart);
      toast.info(
        added > 0 ? `Added ${added} × ${label}` : "Already at the limit",
        `You can order up to ${result.item.limits.max} of this item. Your cart has ${total}.`,
      );
    }
    // The mini-cart drawer confirms it, with the cart and checkout links (BUN-176).
    useMiniCart.getState().show(checkedKey);
    return true;
  }

  return { add, adding };
}
