import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui";
import { CartContents } from "@/features/cart";

// Cart: client-side. The page frame has no user data; the cart is read from
// the visitor's own browser storage, so no cart is ever cached on the server.

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <main className="max-w-content mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-10 md:px-6 md:py-16">
      <h1 className="text-h1">Your cart</h1>
      <CartContents />
      <Link href="/checkout" className={buttonClasses({ className: "self-end" })}>
        Go to checkout
      </Link>
    </main>
  );
}
