"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Button, Card, QuantityStepper, Skeleton } from "@/components/ui";
import { lineTotal } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "./store";
import { removedNoticeText, useServerCart } from "./useServerCart";

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
 * The cart's items with quantity steppers and the subtotal.
 * `empty` is shown when the cart has no items (the cart page passes an empty
 * state with category suggestions); `footer` (e.g. the checkout button) only
 * shows when there are items.
 *
 * Prices and the subtotal come from the server (useServerCart), which
 * re-prices the cart from the ERP whenever it changes.
 */
export function CartContents({ empty, footer }: { empty?: ReactNode; footer?: ReactNode } = {}) {
  const isClient = useIsClient();
  const items = useCartStore((state) => state.items);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const server = useServerCart(isClient);

  if (!isClient) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <span className="sr-only">Loading cart…</span>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const noticeText = removedNoticeText(server.removed);
  const notice = noticeText && (
    <p
      role="status"
      className="bg-warning-soft text-warning text-body-sm rounded-md px-4 py-3 font-semibold"
    >
      {noticeText}
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

  const { currency } = server;
  const checking = server.status === "checking";

  return (
    <div className="flex flex-col gap-4">
      {notice}
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.key}>
            <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="font-bold">{item.name}</span>
                {item.variant && (
                  <span className="text-body-sm text-muted-foreground">{item.variant}</span>
                )}
                <span className="text-body-sm text-muted-foreground">
                  {formatPrice(item.unitPrice, currency)} each
                </span>
              </div>
              <div className="flex items-center gap-3">
                <QuantityStepper
                  size="sm"
                  value={item.quantity}
                  onChange={(quantity) => setQuantity(item.key, quantity)}
                  label={`Quantity of ${item.name}${item.variant ? ` (${item.variant})` : ""}`}
                />
                <span className="w-24 text-right font-bold">
                  {formatPrice(
                    server.lineTotals[item.key] ?? lineTotal(item.unitPrice, item.quantity),
                    currency,
                  )}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.key)}
                  aria-label={`Remove ${item.name}`}
                >
                  Remove
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <CartTotal
        subtotal={server.subtotal}
        currency={currency}
        checking={checking}
        failed={server.status === "error"}
      />
      {footer}
    </div>
  );
}

/** Subtotal from the server. Shows a placeholder while the server is re-pricing. */
export function CartTotal({
  subtotal,
  currency,
  checking,
  failed,
  label = "Subtotal",
}: {
  subtotal: number | null;
  currency: string;
  checking: boolean;
  failed: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-col items-end gap-1" aria-live="polite" aria-busy={checking}>
      <p className="text-body-lg flex items-center gap-2 font-bold">
        {label}:{" "}
        {checking || subtotal === null ? (
          failed ? (
            <span className="text-muted-foreground font-normal">unavailable</span>
          ) : (
            <Skeleton className="inline-block h-6 w-24" />
          )
        ) : (
          formatPrice(subtotal, currency)
        )}
      </p>
      {failed && (
        <p className="text-body-sm text-muted-foreground">
          We couldn&apos;t check the latest prices. They&apos;ll be confirmed at checkout.
        </p>
      )}
    </div>
  );
}
