import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { buttonClasses, Card, Skeleton } from "@/components/ui";
import { SignedInHere } from "@/features/auth/SignedInHere";
import { getSession, safeNext, signInHref } from "@/lib/auth";

export const metadata: Metadata = { title: "Email confirmed", robots: { index: false } };

async function Result({ searchParams }: Pick<PageProps<"/email-verified">, "searchParams">) {
  const { error, next } = await searchParams;
  const goTo = safeNext(typeof next === "string" ? next : undefined);
  const session = error ? null : await getSession();

  if (!session) {
    return (
      <>
        <h1 className="text-h2">This link doesn&apos;t work any more</h1>
        <p className="text-muted-foreground">
          Confirmation links work once, for 24 hours. If you&apos;ve already confirmed your email,
          just sign in. If not, sign in anyway and we&apos;ll send you a new link.
        </p>
        <Link href={signInHref(goTo)} className={buttonClasses({ fullWidth: true })}>
          Sign in
        </Link>
      </>
    );
  }
  return (
    <>
      <SignedInHere />
      <h1 className="text-h2">Your email is confirmed</h1>
      <p className="text-muted-foreground">
        Welcome to Buntalk, {session.name}. You&apos;re signed in.
      </p>
      <Link href={goTo} className={buttonClasses({ fullWidth: true })}>
        Continue
      </Link>
    </>
  );
}

/**
 * Where the email-confirmation link lands (BUN-187): Better Auth has checked
 * the link and signed the customer in, or added `?error=` (expired, used).
 */
export default function EmailVerifiedPage({ searchParams }: PageProps<"/email-verified">) {
  return (
    <Container className="flex justify-center py-10 md:py-16">
      <Card padding="lg" className="flex w-full max-w-md flex-col gap-4">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <Result searchParams={searchParams} />
        </Suspense>
      </Card>
    </Container>
  );
}
