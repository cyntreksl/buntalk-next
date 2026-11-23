"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, FormField, Input } from "@/components/ui";
import { authClient } from "@/lib/auth/client";
import { useHydrated } from "./useHydrated";
import { authErrorMessage } from "./AuthForm";

/**
 * "Forgot password" (BUN-188): emails a reset link that works once, for 30
 * minutes. The answer is the same whether or not the email has an account.
 */
export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setPending(true);
    setError(null);
    const result = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
    setPending(false);
    if (result.error) setError(authErrorMessage(result.error));
    else setSentTo(email);
  }

  if (sentTo) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <p className="text-h4">Check your email</p>
        <p>
          If there&apos;s a Buntalk account for <strong>{sentTo}</strong>, we&apos;ve sent it a link
          to choose a new password. The link works once, for 30 minutes.
        </p>
        <p className="text-body-sm text-muted-foreground">
          Nothing there? Check your spam folder, or{" "}
          <button
            type="button"
            className="text-primary font-semibold underline"
            onClick={() => setSentTo(null)}
          >
            try again
          </button>
          .
        </p>
        <Link href="/sign-in" className="text-primary font-semibold underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form method="post" onSubmit={submit} className="flex flex-col gap-4">
      <FormField label="Email" required>
        <Input name="email" type="email" autoComplete="email" required maxLength={254} />
      </FormField>
      {error && (
        <p
          role="alert"
          className="bg-danger-soft text-danger text-body-sm rounded-md px-3 py-2 font-semibold"
        >
          {error}
        </p>
      )}
      <Button type="submit" loading={pending} disabled={!hydrated} fullWidth>
        Send me a reset link
      </Button>
      <p className="text-body-sm text-muted-foreground text-center">
        Remembered it?{" "}
        <Link href="/sign-in" className="text-primary font-semibold underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
