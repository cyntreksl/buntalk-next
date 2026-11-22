"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircleIcon, Button, EmptyState, buttonClasses } from "@/components/ui";

/**
 * Friendly error screen used by the error boundaries (app/error.tsx,
 * app/(site)/error.tsx, app/(checkout)/error.tsx).
 *
 * In production, Next.js hides server error details from the browser, so this
 * never shows technical messages. It shows a reference code (the error digest)
 * that support can match to the server logs.
 *
 * The most likely cause is the ERP being unreachable, so the wording says the
 * problem is usually temporary and offers "Try again".
 */
export function ErrorContent({
  error,
  retry,
  headingLevel = "h1",
}: {
  error: unknown;
  retry: () => void;
  headingLevel?: "h1" | "h2";
}) {
  const [retrying, setRetrying] = useState(false);
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  useEffect(() => {
    // TODO: send to an error reporting service once one is chosen.
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      headingLevel={headingLevel}
      icon={<AlertCircleIcon size={32} />}
      title="Sorry, something went wrong"
      description={
        <>
          <p>
            We couldn&apos;t load this page right now. This is usually temporary, so please try
            again in a moment.
          </p>
          {digest && <p className="text-caption mt-3">Reference: {digest}</p>}
        </>
      }
      actions={
        <>
          <Button
            loading={retrying}
            onClick={() => {
              setRetrying(true);
              retry();
              // If the retry fails again, this screen re-renders with a fresh state.
              setTimeout(() => setRetrying(false), 4000);
            }}
          >
            Try again
          </Button>
          {/* A full page load (plain <a>), in case client navigation is what broke. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional full reload after an error */}
          <a href="/" className={buttonClasses({ variant: "outline" })}>
            Go to the home page
          </a>
        </>
      }
    >
      <p className="text-body-sm text-muted-foreground">
        Still not working?{" "}
        <Link href="/contact" className="text-primary underline">
          Contact us
        </Link>
        .
      </p>
    </EmptyState>
  );
}
