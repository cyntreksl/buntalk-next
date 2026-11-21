"use client";

import { useState } from "react";
import { Button, QuantityStepper, toast } from "@/components/ui";
import { useCartStore, type CartItem } from "./store";

/**
 * Client island on a cached product page. The page HTML is shared by all
 * visitors; the cart itself lives only in this visitor's browser.
 */
export function AddToCartButton({ item }: { item: Omit<CartItem, "quantity"> }) {
  const addItem = useCartStore((state) => state.addItem);
  const [quantity, setQuantity] = useState(1);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <QuantityStepper value={quantity} onChange={setQuantity} label={`Quantity of ${item.name}`} />
      <Button
        onClick={() => {
          addItem(item, quantity);
          toast.success("Added to cart", `${quantity} × ${item.name}`);
          setQuantity(1);
        }}
      >
        Add to cart
      </Button>
    </div>
  );
}
