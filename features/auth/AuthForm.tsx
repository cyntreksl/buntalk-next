"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, FormField, Input } from "@/components/ui";
import { syncCartNow } from "@/features/cart/CartSync";
import { authClient } from "@/lib/auth/client";
import { getQueryClient } from "@/lib/query-client";
import type { AuthMode } from "./dialog";
import { announce } from "./events";

/** The customer-facing message for a sign-in error from Better Auth. */
export function authErrorMessage(error: { code?: string; status?: number } | null): string {
  switch (error?.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_PASSWORD":
    case "USER_NOT_FOUND":
      return "That email and password don't match. Please try again.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "There's already an account with this email. Sign in instead.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters for your password.";
    case "PASSWORD_TOO_LONG":
      return "Use at most 128 characters for your password.";
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
  }
  if (error?.status === 429) return "Too many tries. Please wait a minute and try again.";
  return "Something went wrong. Please try again.";
}

/**
 * Sign in or create an account (BUN-186), shared by the sign-in pages and
 * the sign-in dialog. Email and password is the first sign-in method; Google,
 * Apple and phone codes join this form in their own tickets.
 *
 * After signing in: the guest cart has already joined the account's cart on
 * the server; this loads it, tells other open tabs, and calls `onDone`.
 */
export function AuthForm({
  mode,
  next,
  onModeChange,
  onDone,
}: {
  mode: AuthMode;
  /** Where the customer goes after signing in (kept when switching between the pages). */
  next?: string;
  /** Switch between sign-in and sign-up in place (dialog); pages link instead. */
  onModeChange?: (mode: AuthMode) => void;
  onDone: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signingUp = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setPending(true);
    setError(null);
    const result = signingUp
      ? await authClient.signUp.email({
          name: String(form.get("name") ?? "").trim(),
          email,
          password,
        })
      : await authClient.signIn.email({ email, password });
    if (result.error) {
      setPending(false);
      setError(authErrorMessage(result.error));
      return;
    }
    await syncCartNow();
    await getQueryClient().invalidateQueries({ queryKey: ["session"] });
    announce("signed-in");
    onDone();
  }

  const switchTo = (target: AuthMode, label: string) =>
    onModeChange ? (
      <button
        type="button"
        onClick={() => {
          setError(null);
          onModeChange(target);
        }}
        className="text-primary font-semibold underline"
      >
        {label}
      </button>
    ) : (
      <Link
        href={next ? `/${target}?${new URLSearchParams({ next })}` : `/${target}`}
        className="text-primary font-semibold underline"
      >
        {label}
      </Link>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate={false}>
      {signingUp && (
        <FormField label="Your name" required>
          <Input name="name" autoComplete="name" required maxLength={120} />
        </FormField>
      )}
      <FormField label="Email" required>
        <Input name="email" type="email" autoComplete="email" required maxLength={254} />
      </FormField>
      <FormField label="Password" hint={signingUp ? "At least 8 characters." : undefined} required>
        <Input
          name="password"
          type="password"
          autoComplete={signingUp ? "new-password" : "current-password"}
          required
          minLength={8}
          maxLength={128}
        />
      </FormField>
      {error && (
        <p
          role="alert"
          className="bg-danger-soft text-danger text-body-sm rounded-md px-3 py-2 font-semibold"
        >
          {error}
        </p>
      )}
      <Button type="submit" loading={pending} fullWidth>
        {signingUp ? "Create account" : "Sign in"}
      </Button>
      <p className="text-body-sm text-muted-foreground text-center">
        {signingUp ? (
          <>Already have an account? {switchTo("sign-in", "Sign in")}</>
        ) : (
          <>New here? {switchTo("sign-up", "Create an account")}</>
        )}
      </p>
    </form>
  );
}
