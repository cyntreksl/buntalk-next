import type { ReactNode } from "react";
import { Container } from "../Container";
import { PageHeader } from "../PageHeader";

type CheckoutTemplateProps = {
  title: ReactNode;
  /** Optional steps indicator (Details → Delivery → Payment). */
  steps?: ReactNode;
  /** The checkout form. */
  children: ReactNode;
  /** Order summary: items, totals. */
  summary: ReactNode;
};

/**
 * Checkout template. Used under the minimal checkout header
 * (app/(checkout)/layout.tsx), so customers aren't pulled away mid-purchase.
 *
 * - Phone/tablet: order summary first (so the total is visible), then the form.
 * - Desktop (lg+): form on the left, summary in a sticky right column.
 */
export function CheckoutTemplate({ title, steps, children, summary }: CheckoutTemplateProps) {
  return (
    <Container className="flex flex-col gap-6 py-8 md:py-12">
      <PageHeader title={title} />
      {steps}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10">
        <aside aria-label="Order summary" className="min-w-0 lg:order-2">
          <div className="lg:sticky lg:top-6">{summary}</div>
        </aside>
        <div className="flex min-w-0 flex-col gap-6 lg:order-1">{children}</div>
      </div>
    </Container>
  );
}
