"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button, Card, QuantityStepper, Skeleton } from "@/components/ui";
import { formatPrice } from "@/lib/utils";
import { validateCart } from "./api";
import { useCartStore } from "./store";

// The cart is read from localStorage, which only exists in the browser.
// Render a placeholder on the server and during hydration, then show the real cart.
const subscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/**
 * The cart's items with quantity steppers and the total.
 * `empty` is shown when the cart has no items (the cart page passes an empty
 * state with category suggestions); `footer` (e.g. the checkout button) only
 * shows when there are items.
 */
export function CartContents({ empty, footer }: { empty?: ReactNode; footer?: ReactNode } = {}) {
  const isClient = useIsClient();
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const removedNames = useCartCheck(isClient);

  if (!isClient) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">Loading cart…</span>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  const notice = removedNames.length > 0 && (
    <p
      role="status"
      className="bg-warning-soft text-warning text-body-sm rounded-md px-4 py-3 font-semibold"
    >
      {removedNames.join(", ")} {removedNames.length === 1 ? "is" : "are"} no longer available
      online and {removedNames.length === 1 ? "was" : "were"} removed from your cart.
    </p>
  );

  if (items.length === 0) {
    return (
      <>
        {notice}
        {empty ?? <p className="text-muted-foreground">Your cart is empty.</p>}
      </>
    );
  }

  // Display total only. The real total is recalculated from the ERP at checkout.
  const currency = "LKR";
  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <div className="flex flex-col gap-4">
      {notice}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.sku}>
            <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="font-bold">{item.name}</span>
                <span className="text-body-sm text-muted-foreground">
                  {formatPrice(item.unitPrice, currency)} each
                </span>
              </div>
              <div className="flex items-center gap-3">
                <QuantityStepper
                  size="sm"
                  value={item.quantity}
                  onChange={(quantity) => setQuantity(item.sku, quantity)}
                  label={`Quantity of ${item.name}`}
                />
                <span className="w-24 text-right font-bold">
                  {formatPrice(item.unitPrice * item.quantity, currency)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.sku)}
                  aria-label={`Remove ${item.name}`}
                >
                  Remove
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <p className="text-body-lg text-right font-bold">Total: {formatPrice(total, currency)}</p>
      {footer}
    </div>
  );
}

/**
 * Re-checks the cart with the ERP once, when the cart opens: products hidden
 * in the ERP since they were added are dropped, and names and prices are
 * refreshed. Returns the names of the dropped products, for the notice.
 * If the check can't run (offline, ERP down), the cart is left as it is;
 * checkout checks again anyway.
 */
function useCartCheck(enabled: boolean): string[] {
  const [removedNames, setRemovedNames] = useState<string[]>([]);
  const checked = useRef(false);

  useEffect(() => {
    if (!enabled || checked.current) return;
    checked.current = true;
    const { items, replaceItems } = useCartStore.getState();
    if (items.length === 0) return;

    void validateCart(items).then((result) => {
      if (!result) return;
      const removed = new Set(result.removed.map((r) => r.sku));
      // Keep quantity changes the visitor made while the check was running.
      const current = useCartStore.getState().items;
      const fresh = new Map(result.items.map((i) => [i.sku, i]));
      replaceItems(
        current
          .filter((i) => !removed.has(i.sku))
          .map((i) => {
            const checkedItem = fresh.get(i.sku);
            return checkedItem
              ? { ...i, name: checkedItem.name, unitPrice: checkedItem.unitPrice }
              : i;
          }),
      );
      setRemovedNames(items.filter((i) => removed.has(i.sku)).map((i) => i.name));
    });
  }, [enabled]);

  return removedNames;
}
