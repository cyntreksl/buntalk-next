"use client";

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Container } from "@/components/layout/Container";
import { ErrorContent } from "@/components/feedback/ErrorContent";

/**
 * Error boundary for when a whole layout fails (e.g. the site header itself).
 * The site header can't be trusted here, so this shows a minimal one.
 * Page-level errors are handled closer, by app/(site)/error.tsx.
 */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <title>Something went wrong | Buntalk</title>
      <header className="border-border bg-surface border-b">
        <Container className="py-3">
          <Link href="/" aria-label="Buntalk home" className="inline-block">
            <Logo variant="compact" height={36} />
          </Link>
        </Container>
      </header>
      <main id="main-content" className="flex flex-1 flex-col">
        <Container width="content" className="py-10 md:py-16">
          <ErrorContent error={error} retry={retry} />
        </Container>
      </main>
    </div>
  );
}
