import type { Metadata } from "next";
import Link from "next/link";
import { CartContents } from "@/features/cart";

// Cart: client-side. The page frame has no user data; the cart is read from
// the visitor's own browser storage, so no cart is ever cached on the server.

export const metadata: Metadata = { title: "Cart" };

export default function CartPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Your cart</h1>
      <CartContents />
      <Link href="/checkout" className="self-start underline">
        Go to checkout
      </Link>
    </main>
  );
}
