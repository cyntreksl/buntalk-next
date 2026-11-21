import type { Metadata } from "next";
import { CheckoutFooter, CheckoutHeader } from "@/components/layout/CheckoutHeader";
import { PageShell } from "@/components/layout/PageShell";

/**
 * Checkout: minimal header and footer so customers stay focused on finishing
 * the order.
 *
 * Rendering: dynamic, never cached for other users (same rules as the
 * (private) pages — see README "Rendering strategy"). `ensureStatic = false`
 * stops anything forcing this route static; next.config.ts sends
 * `Cache-Control: private, no-store` for /checkout.
 */
export const ensureStatic = false;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: LayoutProps<"/">) {
  return (
    <PageShell header={<CheckoutHeader />} footer={<CheckoutFooter />}>
      {children}
    </PageShell>
  );
}
