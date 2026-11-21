import type { Metadata } from "next";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";

// Account: dynamic, rendered per request from the visitor's session cookie.

export const metadata: Metadata = { title: "My account" };

async function AccountDetails() {
  const session = await getSession();
  if (!session) {
    return <p className="text-foreground/70">Please sign in to see your account.</p>;
  }
  return <p>Signed in. Orders and profile details come in a later ticket.</p>;
}

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">My account</h1>
      <Suspense fallback={<p className="text-foreground/70">Loading your account…</p>}>
        <AccountDetails />
      </Suspense>
    </main>
  );
}
