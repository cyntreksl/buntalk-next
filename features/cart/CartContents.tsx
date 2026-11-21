"use client";

import { useSyncExternalStore } from "react";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "./store";

// The cart is read from localStorage, which only exists in the browser.
// Render nothing on the server and during hydration, then show the real cart.
const subscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

export function CartContents() {
  const isClient = useIsClient();
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);

  if (!isClient) return <p className="text-muted-foreground">Loading cart…</p>;
  if (items.length === 0) return <p className="text-muted-foreground">Your cart is empty.</p>;

  // Display total only. The real total is recalculated from the ERP at checkout.
  const currency = "LKR";
  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.sku} className="flex items-center justify-between gap-4">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span className="flex items-center gap-3">
              {formatPrice(item.unitPrice * item.quantity, currency)}
              <button
                type="button"
                onClick={() => removeItem(item.sku)}
                className="text-body-sm text-primary underline"
              >
                Remove
              </button>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-body-lg font-bold">Total: {formatPrice(total, currency)}</p>
    </div>
  );
}
