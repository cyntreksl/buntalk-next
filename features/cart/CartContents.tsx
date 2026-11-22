"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Button, Card, QuantityStepper, Skeleton } from "@/components/ui";
import { lineTotal } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import { useCartStore } from "./store";
import { removedNoticeText, useServerCart, type ServerCartState } from "./useServerCart";

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
 * The cart's items with quantity steppers and the totals.
 * `empty` is shown when the cart has no items (the cart page passes an empty
 * state with category suggestions); `footer` (e.g. the checkout button) only
 * shows when there are items.
 *
 * Prices, discounts and totals come from the server (useServerCart), which
 * re-prices the cart with the ERP and its scheme engine whenever it changes.
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

  return (
    <div className="flex flex-col gap-4">
      {notice}
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const pricing = server.lines[item.key];
          return (
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
                  {pricing && pricing.discount > 0 && (
                    <span className="text-body-sm text-success font-semibold">
                      {pricing.schemes.map((s) => s.name).join(", ") || "Offer"}: −
                      {formatPrice(pricing.discount, currency)}
                    </span>
                  )}
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
                      pricing?.lineSubtotal ?? lineTotal(item.unitPrice, item.quantity),
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
          );
        })}
      </ul>
      <CartTotals server={server} className="self-stretch sm:ml-auto sm:w-80" />
      {footer}
    </div>
  );
}

/**
 * Subtotal, each offer the ERP applied ("which scheme gave which discount"),
 * free items, and the total. All numbers come from the server; a placeholder
 * shows while it re-prices.
 */
export function CartTotals({ server, className }: { server: ServerCartState; className?: string }) {
  const { totals, currency } = server;
  const checking = server.status === "checking";
  const failed = server.status === "error";
  const amount = (value: number | undefined) =>
    checking || value === undefined ? (
      <Skeleton className="inline-block h-5 w-20" />
    ) : (
      formatPrice(value, currency)
    );

  // Lines and the subtotal are before offers; each applied scheme lists everything
  // it saved (line and order level), so Subtotal − offers = Total, as the ERP calculated.
  return (
    <div className={className} aria-live="polite" aria-busy={checking}>
      <dl className="flex flex-col gap-1.5">
        <div className="flex justify-between gap-4">
          <dt>Subtotal</dt>
          <dd>{failed ? "—" : amount(totals?.subtotal)}</dd>
        </div>
        {!checking &&
          server.appliedSchemes.map((s) => (
            <div key={s.id} className="text-success flex justify-between gap-4 font-semibold">
              <dt className="min-w-0">
                {s.name}
                {s.description && (
                  <span className="text-body-sm text-muted-foreground block font-normal">
                    {s.description}
                  </span>
                )}
              </dt>
              <dd className="shrink-0">−{formatPrice(s.discount, currency)}</dd>
            </div>
          ))}
        {!checking &&
          server.freeItems.map((f) => (
            <div key={`${f.name}-${f.variant}`} className="text-success flex justify-between gap-4">
              <dt className="min-w-0">
                Free: {f.name}
                {f.variant && ` (${f.variant})`} × {f.quantity}
                <span className="text-body-sm text-muted-foreground block">{f.schemeName}</span>
              </dt>
              <dd className="shrink-0 font-semibold">Free</dd>
            </div>
          ))}
        <div className="border-border text-body-lg flex justify-between gap-4 border-t pt-2 font-bold">
          <dt>Total</dt>
          <dd>{failed ? "—" : amount(totals?.total)}</dd>
        </div>
      </dl>
      {failed && (
        <p className="text-body-sm text-muted-foreground mt-2">
          We couldn&apos;t check the latest prices and offers. They&apos;ll be confirmed at
          checkout.
        </p>
      )}
    </div>
  );
}
