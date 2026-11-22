"use client";

import { useState } from "react";
import { Button, QuantityStepper, toast } from "@/components/ui";
import { checkItem } from "./api";
import { useCartStore, type CartItem } from "./store";

/**
 * Client island on a cached product page. The page HTML is shared by all
 * visitors; the cart itself lives only in this visitor's browser.
 *
 * Before adding, the server checks the product with the ERP (it may have been
 * hidden since this cached page was built). What goes into the cart is the
 * server's answer, so the name and price come from the ERP.
 */
export function AddToCartButton({ item }: { item: Omit<CartItem, "quantity"> }) {
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  async function add() {
    setAdding(true);
    const result = await checkItem(item.sku, quantity);
    setAdding(false);

    if (!result.ok) {
      toast.error(
        result.reason === "not_available" ? "Not available" : "Couldn't add to cart",
        result.message,
      );
      return;
    }
    const { quantity: added, ...checked } = result.item;
    addItem(checked, added);
    toast.success("Added to cart", `${added} × ${checked.name}`);
    setQuantity(1);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <QuantityStepper value={quantity} onChange={setQuantity} label={`Quantity of ${item.name}`} />
      <Button onClick={add} loading={adding}>
        Add to cart
      </Button>
    </div>
  );
}
