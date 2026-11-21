"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { BagIcon } from "@/components/ui";
import { selectCartCount, useCartStore } from "@/features/cart";

const subscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/**
 * Cart icon with the number of items. Reads the cart store directly, so the
 * count changes the moment an item is added anywhere on the page. The count
 * only appears after hydration (the cart lives in the browser), so cached
 * HTML never shows another visitor's number.
 */
export function CartButton() {
  const isClient = useIsClient();
  const count = useCartStore(selectCartCount);
  const shown = isClient ? count : 0;
  const label = shown === 0 ? "Cart, empty" : `Cart, ${shown} item${shown === 1 ? "" : "s"}`;

  return (
    <Link
      href="/cart"
      aria-label={label}
      className="text-foreground hover:bg-surface-muted relative inline-flex size-10 items-center justify-center rounded-md"
    >
      <BagIcon size={22} />
      {shown > 0 && (
        <span
          aria-hidden="true"
          className="bg-primary text-primary-foreground text-caption absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-bold"
        >
          {shown > 99 ? "99+" : shown}
        </span>
      )}
    </Link>
  );
}
