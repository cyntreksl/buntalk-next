import type { Metadata } from "next";
import Link from "next/link";
import { AccountTemplate } from "@/components/layout/templates";
import { BagIcon, EmptyState, buttonClasses } from "@/components/ui";
import { AccountGate } from "@/features/account/AccountGate";

// Account › Orders: account template. Dynamic, per user.
// Order history comes from the ERP in a later ticket; until then every
// signed-in customer sees the "no orders yet" empty state.

export const metadata: Metadata = { title: "Orders" };

export default function AccountOrdersPage() {
  return (
    <AccountTemplate active="orders" title="Orders">
      <AccountGate>
        <EmptyState
          icon={<BagIcon size={32} />}
          title="No orders yet"
          description={<p>When you place an order, you&apos;ll be able to track it here.</p>}
          actions={
            <Link href="/" className={buttonClasses()}>
              Start shopping
            </Link>
          }
        />
      </AccountGate>
    </AccountTemplate>
  );
}
