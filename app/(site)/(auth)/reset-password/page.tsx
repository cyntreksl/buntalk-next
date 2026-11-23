import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { Card, Skeleton } from "@/components/ui";
import { ResetPasswordForm, ResetResult } from "@/features/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

async function Form({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const { token, error } = await searchParams;
  // Better Auth checked the link: `?token=` when it's valid, `?error=INVALID_TOKEN` when not.
  if (error || typeof token !== "string" || !/^[A-Za-z0-9_-]{8,200}$/.test(token)) {
    return <ResetResult expired />;
  }
  return <ResetPasswordForm token={token} />;
}

/**
 * Where the reset link lands (BUN-188): choose a new password. The link works
 * once, for 30 minutes; afterwards every session of the account is signed out.
 */
export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <Container className="flex justify-center py-10 md:py-16">
      <Card padding="lg" className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-h2">Choose a new password</h1>
          <p className="text-muted-foreground">You&apos;ll sign in with it from now on.</p>
        </div>
        <Suspense fallback={<Skeleton className="h-48 w-full" />}>
          <Form searchParams={searchParams} />
        </Suspense>
      </Card>
    </Container>
  );
}
