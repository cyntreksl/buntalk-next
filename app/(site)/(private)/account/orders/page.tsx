import type { Metadata } from "next";
import { AccountTemplate } from "@/components/layout/templates";
import { Card } from "@/components/ui";
import { AccountGate } from "@/features/account/AccountGate";

// Account › Orders: account template. Dynamic, per user. Content comes in a later ticket.

export const metadata: Metadata = { title: "Orders" };

export default function AccountOrdersPage() {
  return (
    <AccountTemplate active="orders" title="Orders">
      <AccountGate>
        <Card padding="lg">
          <p className="text-muted-foreground">Your orders will appear here.</p>
        </Card>
      </AccountGate>
    </AccountTemplate>
  );
}
