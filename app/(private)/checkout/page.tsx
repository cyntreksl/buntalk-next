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
    <p className="text-muted-foreground">
      {session ? "Checking out as a signed-in customer." : "Checking out as a guest."}
    </p>
  );
}

export default function CheckoutPage() {
  return (
    <main className="max-w-content mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-10 md:px-6 md:py-16">
      <h1 className="text-h1">Checkout</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <CheckoutCustomer />
      </Suspense>
      <CartContents />
    </main>
  );
}
