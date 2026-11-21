import type { Metadata } from "next";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";

// Account: dynamic, rendered per request from the visitor's session cookie.

export const metadata: Metadata = { title: "My account" };

async function AccountDetails() {
  const session = await getSession();
  if (!session) {
    return <p className="text-muted-foreground">Please sign in to see your account.</p>;
  }
  return <p>Signed in. Orders and profile details come in a later ticket.</p>;
}

export default function AccountPage() {
  return (
    <main className="max-w-content mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-10 md:px-6 md:py-16">
      <h1 className="text-h1">My account</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading your account…</p>}>
        <AccountDetails />
      </Suspense>
    </main>
  );
}
