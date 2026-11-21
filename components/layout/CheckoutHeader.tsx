import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ChevronLeftIcon } from "@/components/ui";

/** Minimal header for checkout: logo and a way back to the cart, no other navigation. */
export function CheckoutHeader() {
  return (
    <header className="border-border bg-surface border-b">
      <div className="max-w-page mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" aria-label="Buntalk home" className="shrink-0">
          <Logo variant="compact" height={36} priority />
        </Link>
        <Link
          href="/cart"
          className="text-body-sm text-muted-foreground hover:text-foreground flex items-center gap-1 font-bold"
        >
          <ChevronLeftIcon size={16} />
          Back to cart
        </Link>
      </div>
    </header>
  );
}

/** Minimal footer for checkout. */
export function CheckoutFooter() {
  return (
    <footer className="border-border text-body-sm text-muted-foreground border-t">
      <div className="max-w-page mx-auto w-full px-4 py-5 md:px-6">
        Secure checkout · Prices and stock are confirmed when you place the order.
      </div>
    </footer>
  );
}
