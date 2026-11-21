import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutTemplate } from "@/components/layout/templates";
import { Card, Skeleton } from "@/components/ui";
import { CartSummary } from "@/features/cart";
import { getSession } from "@/lib/auth";

// Checkout: checkout template under the minimal header. Dynamic, rendered per
// request. Prices and stock are re-checked against the ERP when the order is
// placed (payment flow: BUN-203).

export const metadata: Metadata = { title: "Checkout" };

async function CheckoutCustomer() {
  const session = await getSession();
  return (
    <p className="text-muted-foreground">
      {session ? "Checking out as a signed-in customer." : "Checking out as a guest."}
    </p>
  );
}

const steps = [
  { id: "contact", title: "1. Contact details" },
  { id: "delivery", title: "2. Delivery" },
  { id: "payment", title: "3. Payment" },
];

export default function CheckoutPage() {
  return (
    <CheckoutTemplate title="Checkout" summary={<CartSummary />}>
      <Suspense fallback={<Skeleton className="h-5 w-64" />}>
        <CheckoutCustomer />
      </Suspense>
      {/* Placeholder sections: the checkout form itself is built in the checkout and payment tickets. */}
      {steps.map((step) => (
        <Card key={step.id} padding="lg" className="flex flex-col gap-2">
          <h2 className="text-h3">{step.title}</h2>
          <p className="text-muted-foreground">Coming soon.</p>
        </Card>
      ))}
    </CheckoutTemplate>
  );
}
