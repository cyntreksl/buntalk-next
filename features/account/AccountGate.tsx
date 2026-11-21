import { Suspense, type ReactNode } from "react";
import { Card, Skeleton } from "@/components/ui";
import { getSession } from "@/lib/auth";

async function Gate({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    return (
      <Card padding="lg">
        <p className="text-muted-foreground">Please sign in to see your account.</p>
      </Card>
    );
  }
  return <>{children}</>;
}

/**
 * Shows its content only to signed-in customers. Reads the session cookie
 * inside <Suspense>, so account pages render per request and are never cached
 * for other users. Sign-in itself comes with BUN-186.
 */
export function AccountGate({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div role="status" className="flex flex-col gap-3">
          <span className="sr-only">Loading your account…</span>
          <Skeleton className="h-24 w-full" />
        </div>
      }
    >
      <Gate>{children}</Gate>
    </Suspense>
  );
}
