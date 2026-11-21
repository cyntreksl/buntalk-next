import type { Metadata } from "next";
import { AccountTemplate } from "@/components/layout/templates";
import { Card } from "@/components/ui";
import { AccountGate } from "@/features/account/AccountGate";

// Account › Profile: account template. Dynamic, per user. Content comes in a later ticket.

export const metadata: Metadata = { title: "Profile" };

export default function AccountProfilePage() {
  return (
    <AccountTemplate active="profile" title="Profile">
      <AccountGate>
        <Card padding="lg">
          <p className="text-muted-foreground">
            Your name, email and phone number will appear here.
          </p>
        </Card>
      </AccountGate>
    </AccountTemplate>
  );
}
