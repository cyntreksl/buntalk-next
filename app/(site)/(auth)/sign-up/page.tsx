import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { Card, Skeleton } from "@/components/ui";
import { AuthPage } from "@/features/auth/AuthPage";
import { getSession, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

async function Form({ searchParams }: Pick<PageProps<"/sign-up">, "searchParams">) {
  const { next } = await searchParams;
  const goTo = safeNext(typeof next === "string" ? next : undefined);
  // Already signed in: straight on.
  if (await getSession()) redirect(goTo);
  return <AuthPage mode="sign-up" next={goTo} />;
}

/**
 * Create an account (BUN-186). `?next=/path` comes back there afterwards (only paths on
 * this site; see safeNext). The same form is in the sign-in dialog.
 */
export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <Container className="flex justify-center py-10 md:py-16">
      <Card padding="lg" className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-h2">Create an account</h1>
          <p className="text-muted-foreground">
            Order faster, track your orders and keep your cart on every device.
          </p>
        </div>
        <Suspense fallback={<Skeleton className="h-72 w-full" />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </Card>
    </Container>
  );
}
