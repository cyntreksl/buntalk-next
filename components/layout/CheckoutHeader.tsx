import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ChevronLeftIcon } from "@/components/ui";
import { contentPages, policyPageIds } from "@/lib/content-pages";

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

/** Minimal footer for checkout: a reassurance line and the policy links (customers often check them before paying). */
export function CheckoutFooter() {
  return (
    <footer className="border-border text-body-sm text-muted-foreground border-t">
      <div className="max-w-page mx-auto flex w-full flex-col gap-2 px-4 py-5 md:px-6">
        <p>Secure checkout · Prices and stock are confirmed when you place the order.</p>
        <nav aria-label="Policies">
          <ul className="text-caption flex flex-wrap gap-x-4 gap-y-1">
            {policyPageIds.map((id) => (
              <li key={id}>
                <Link href={contentPages[id].href} className="hover:text-primary underline">
                  {contentPages[id].title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
