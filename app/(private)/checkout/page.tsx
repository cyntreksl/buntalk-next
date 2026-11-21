import type { Metadata } from "next";
import { Suspense } from "react";
import { CartContents } from "@/features/cart";
import { getSession } from "@/lib/auth";

// Checkout: dynamic, rendered per request. Prices and stock are re-checked
// against the ERP when the order is placed (payment flow: BUN-203).

export const metadata: Metadata = { title: "Checkout" };

async function CheckoutCustomer() {
  const session = await getSession();
  return (
    <p className="text-foreground/70">
      {session ? "Checking out as a signed-in customer." : "Checking out as a guest."}
    </p>
  );
}

export default function CheckoutPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Checkout</h1>
      <Suspense fallback={<p className="text-foreground/70">Loading…</p>}>
        <CheckoutCustomer />
      </Suspense>
      <CartContents />
    </main>
  );
}
