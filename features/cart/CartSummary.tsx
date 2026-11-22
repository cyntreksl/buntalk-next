"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Card, Skeleton } from "@/components/ui";
import { lineTotal } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import { CartTotal } from "./CartContents";
import { useCartStore } from "./store";
import { removedNoticeText, useServerCart } from "./useServerCart";

const subscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/**
 * Compact, read-only order summary for checkout. Prices and the subtotal come
 * from the server (ERP prices). Placing the order prices it again on the
 * server (lib/cart.server.ts priceCart), and the ERP re-prices it too.
 */
export function CartSummary() {
  const isClient = useIsClient();
  const items = useCartStore((state) => state.items);
  // Re-priced from the ERP on the server; the browser never adds up what is charged.
  const server = useServerCart(isClient);
  const { currency } = server;
  const notice = removedNoticeText(server.removed);

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
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground">
            Your cart is empty, so there&apos;s nothing to check out yet.
          </p>
          <Link href="/" className="text-body-sm text-primary font-bold underline">
            Continue shopping
          </Link>
        </div>
      ) : (
        <>
          {notice && (
            <p role="status" className="text-body-sm text-warning font-semibold">
              {notice}
            </p>
          )}
          <ul className="text-body-sm flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.key} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">
                  {item.name}
                  {item.variant && ` (${item.variant})`} × {item.quantity}
                </span>
                <span className="shrink-0">
                  {formatPrice(
                    server.lineTotals[item.key] ?? lineTotal(item.unitPrice, item.quantity),
                    currency,
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-border border-t pt-3">
            <CartTotal
              subtotal={server.subtotal}
              currency={currency}
              checking={server.status === "checking"}
              failed={server.status === "error"}
            />
          </div>
        </>
      )}
    </Card>
  );
}
