import type { Metadata } from "next";
import { AccountTemplate } from "@/components/layout/templates";
import { Card } from "@/components/ui";
import { AccountGate } from "@/features/account/AccountGate";
import { SignOutButton } from "@/features/auth/SignOutButton";
import { getSession, listSignInMethods } from "@/lib/auth";

// Account: account template. Dynamic, rendered per request from the visitor's session.

export const metadata: Metadata = { title: "My account" };

async function Overview() {
  const [session, methods] = await Promise.all([getSession(), listSignInMethods()]);
  if (!session) return null;
  return (
    <>
      <Card padding="lg" className="flex flex-col gap-1">
        <h2 className="text-h3">Hello, {session.name}</h2>
        <p className="text-muted-foreground">{session.email}</p>
        <p className="text-body-sm text-muted-foreground">
          Your recent orders and details will appear here.
        </p>
      </Card>
      <Card padding="lg" className="flex flex-col gap-3">
        <h2 className="text-h4">Signing in</h2>
        <p className="text-body-sm text-muted-foreground">Ways you can sign in to this account:</p>
        <ul className="flex flex-wrap gap-2">
          {methods.map((m) => (
            <li
              key={m.id}
              className="bg-surface-muted text-body-sm rounded-full px-3 py-1 font-semibold"
            >
              {m.label}
            </li>
          ))}
        </ul>
        <p className="text-body-sm text-muted-foreground">
          You stay signed in on this device for 30 days after your last visit.
        </p>
        <div className="flex flex-wrap gap-2">
          <SignOutButton />
          <SignOutButton everywhere variant="ghost" />
        </div>
      </Card>
    </>
  );
}

export default function AccountPage() {
  return (
    <AccountTemplate active="overview" title="My account">
      <AccountGate>
        <Overview />
      </AccountGate>
    </AccountTemplate>
  );
}
