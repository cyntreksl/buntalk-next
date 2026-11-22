"use client";

import { useState } from "react";
import { toast } from "@/components/ui";
import { checkItem } from "./api";
import { useCartStore } from "./store";

/**
 * Adds a product (and size) to the cart. The server checks it with the ERP
 * first and returns the price to put in the cart; nothing here calculates a
 * price. Shows a toast either way. Used by the product page and the quick
 * "Add to cart" on product cards.
 */
export function useAddToCart() {
  const addItem = useCartStore((state) => state.addItem);
  const [adding, setAdding] = useState(false);

  async function add(line: { productSlug: string; skuId?: string; quantity: number }) {
    setAdding(true);
    const result = await checkItem(line);
    setAdding(false);

    if (!result.ok) {
      const title =
        result.reason === "not_available"
          ? "Not available"
          : result.reason === "sold_out"
            ? "Sold out"
            : result.reason === "choose_variant"
              ? "Choose a size"
              : "Couldn't add to cart";
      toast.error(title, result.message);
      return false;
    }
    const { key, productSlug, skuId, name, variant, unitPrice, quantity } = result.item;
    addItem({ key, productSlug, skuId, name, variant, unitPrice }, quantity);
    toast.success("Added to cart", `${quantity} × ${name}${variant ? ` (${variant})` : ""}`);
    return true;
  }

  return { add, adding };
}
