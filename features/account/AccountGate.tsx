import { Suspense, type ReactNode } from "react";
import { Skeleton } from "@/components/ui";
import { requireSession } from "@/lib/auth";

async function Gate({ children, returnTo }: { children: ReactNode; returnTo: string }) {
  await requireSession(returnTo);
  return <>{children}</>;
}

/**
 * Shows its content only to signed-in customers; anyone else goes to sign-in
 * and comes back to `returnTo` afterwards (BUN-186). The session is checked
 * on the server against the database (the proxy only checks for the cookie).
 * Reads the session inside <Suspense>, so account pages render per request
 * and are never cached for other users.
 */
export function AccountGate({
  children,
  returnTo = "/account",
}: {
  children: ReactNode;
  returnTo?: string;
}) {
  return (
    <Suspense
      fallback={
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Loading your account…</span>
          <Skeleton className="h-24 w-full" />
        </div>
      }
    >
      <Gate returnTo={returnTo}>{children}</Gate>
    </Suspense>
  );
}
