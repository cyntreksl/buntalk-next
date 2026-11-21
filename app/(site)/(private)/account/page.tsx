import type { Metadata } from "next";
import { AccountTemplate } from "@/components/layout/templates";
import { Card } from "@/components/ui";
import { AccountGate } from "@/features/account/AccountGate";

// Account: account template. Dynamic, rendered per request from the visitor's session cookie.

export const metadata: Metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <AccountTemplate active="overview" title="My account">
      <AccountGate>
        <Card padding="lg">
          <p>Signed in. Your recent orders and details will appear here.</p>
        </Card>
      </AccountGate>
    </AccountTemplate>
  );
}
