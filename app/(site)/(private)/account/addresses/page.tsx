import type { Metadata } from "next";
import { AccountTemplate } from "@/components/layout/templates";
import { Card } from "@/components/ui";
import { AccountGate } from "@/features/account/AccountGate";

// Account › Addresses: account template. Dynamic, per user. Content comes in a later ticket.

export const metadata: Metadata = { title: "Addresses" };

export default function AccountAddressesPage() {
  return (
    <AccountTemplate active="addresses" title="Addresses">
      <AccountGate returnTo="/account/addresses">
        <Card padding="lg">
          <p className="text-muted-foreground">Your saved delivery addresses will appear here.</p>
        </Card>
      </AccountGate>
    </AccountTemplate>
  );
}
