"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button, Drawer, QuantityStepper, buttonClasses } from "@/components/ui";
import { MAX_QUANTITY } from "@/lib/cart/limits";
import { formatPrice, cx } from "@/lib/utils";
import { CartTotals } from "./CartContents";
import { CartLineThumb } from "./CartLineThumb";
import { useMiniCart } from "./miniCart";
import { selectCartCount, useCartStore } from "./store";
import { editDesignHref } from "./cake";
import { cartNoticeText, useServerCart } from "./useServerCart";

/**
 * Mini-cart drawer (BUN-176). Opens from the right after "Add to cart": the
 * line just added is highlighted, every line can be changed or removed, and
 * the totals come from the server (ERP prices and offers). "Checkout" and
 * "View cart" move on; "Continue shopping" or Esc closes it. Rendered once,
 * in the app providers.
 */
export function MiniCartDrawer() {
  const { open, lastAddedKey, close } = useMiniCart();
  const items = useCartStore((s) => s.items);
  const count = useCartStore(selectCartCount);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  // Re-priced from the ERP while the drawer is open.
  const server = useServerCart(open);

  // Close when the page changes (e.g. after "View cart"); state from the last render.
  const pathname = usePathname();
  const [path, setPath] = useState(pathname);
  if (path !== pathname) {
    setPath(pathname);
    if (open) close();
  }

  const notice = cartNoticeText(server);
  const justAdded = items.some((i) => i.key === lastAddedKey);

  return (
    <Drawer
      open={open}
      onClose={close}
      side="right"
      title={justAdded ? "Added to your cart" : "Your cart"}
      description={
        count === 0 ? "Your cart is empty" : `${count} item${count === 1 ? "" : "s"} in your cart`
      }
      footer={
        items.length > 0 ? (
          <>
            <CartTotals server={server} />
            <Link href="/checkout" className={buttonClasses({ fullWidth: true })}>
              Checkout
            </Link>
            <Link href="/cart" className={buttonClasses({ variant: "outline", fullWidth: true })}>
              View cart
            </Link>
            <Button variant="ghost" fullWidth onClick={close}>
              Continue shopping
            </Button>
          </>
        ) : (
          <Link href="/" className={buttonClasses({ fullWidth: true })}>
            Start shopping
          </Link>
        )
      }
    >
      {notice && (
        <p
          role="status"
          className="bg-warning-soft text-warning text-body-sm mb-4 rounded-md px-3 py-2 font-semibold"
        >
          {notice}
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-muted-foreground">Add something you like and it will show up here.</p>
      ) : (
        <ul className="divide-border flex flex-col divide-y">
          {items.map((item) => {
            const pricing = server.lines[item.key];
            const highlighted = item.key === lastAddedKey;
            return (
              <li
                key={item.key}
                className={cx(
                  "flex gap-3 py-3 first:pt-0",
                  highlighted && "bg-accent-soft/50 -mx-2 rounded-lg px-2 first:pt-3",
                )}
              >
                <CartLineThumb item={item} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Link
                    href={`/product/${item.productSlug}`}
                    className="text-body-sm hover:text-primary line-clamp-2 font-bold"
                  >
                    {item.name}
                  </Link>
                  {(item.variant || item.customization) && (
                    <span className="text-caption text-muted-foreground line-clamp-2">
                      {[
                        item.variant,
                        item.customization &&
                          (item.customization.summary.join(" · ") || "Cake Studio design"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                  {item.customization && (
                    <Link
                      href={editDesignHref(item)!}
                      className="text-caption text-primary self-start font-semibold underline"
                    >
                      Edit design
                      <span className="sr-only">: {item.name}</span>
                    </Link>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <QuantityStepper
                      size="sm"
                      value={item.quantity}
                      onChange={(q) => setQuantity(item.key, q)}
                      min={pricing?.limits.min ?? 1}
                      max={pricing?.limits.max ?? MAX_QUANTITY}
                      label={`Quantity of ${item.name}`}
                    />
                    <span className="text-body-sm font-bold">
                      {formatPrice(
                        pricing?.lineSubtotal ?? item.unitPrice * item.quantity,
                        server.currency,
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="text-caption text-muted-foreground hover:text-danger self-start underline-offset-2 hover:underline"
                    aria-label={`Remove ${item.name}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
