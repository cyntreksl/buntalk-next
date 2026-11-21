"use client";

import { useSyncExternalStore } from "react";
import { Card, Skeleton } from "@/components/ui";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "./store";

const subscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/** Compact, read-only order summary for checkout. */
export function CartSummary() {
  const isClient = useIsClient();
  const items = useCartStore((state) => state.items);
  const currency = "LKR";
  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-h4">Order summary</h2>
      {!isClient ? (
        <div role="status" className="flex flex-col gap-2">
          <span className="sr-only">Loading order summary…</span>
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">Your cart is empty.</p>
      ) : (
        <>
          <ul className="text-body-sm flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.sku} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">
                  {item.name} × {item.quantity}
                </span>
                <span className="shrink-0">
                  {formatPrice(item.unitPrice * item.quantity, currency)}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-border flex justify-between border-t pt-3 font-bold">
            <span>Total</span>
            <span>{formatPrice(total, currency)}</span>
          </div>
        </>
      )}
    </Card>
  );
}
