"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, buttonClasses } from "@/components/ui";
import { authClient } from "@/lib/auth/client";
import { useHydrated } from "./useHydrated";
import { passwordProblem } from "@/lib/auth/password";
import { authErrorMessage } from "./AuthForm";
import { announce, forgetAccountState } from "./events";
import { PasswordInput, PasswordRules } from "./PasswordFields";

/**
 * Choose a new password from the reset link (BUN-188). Afterwards every
 * session of the account is signed out, so the customer signs in again.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"form" | "done" | "expired">("form");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    setPending(true);
    setError(null);
    const result = await authClient.resetPassword({ newPassword: password, token });
    setPending(false);
    if (result.error?.code === "INVALID_TOKEN") {
      setState("expired");
    } else if (result.error) {
      setError(authErrorMessage(result.error));
    } else {
      // Every session of the account has ended, including any in this browser.
      forgetAccountState();
      announce("signed-out");
      setState("done");
    }
  }

  if (state !== "form") return <ResetResult expired={state === "expired"} />;

  return (
    <form method="post" onSubmit={submit} className="flex flex-col gap-4">
      <PasswordInput
        label="New password"
        name="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        error={error ?? undefined}
      />
      <PasswordRules password={password} />
      <Button type="submit" loading={pending} disabled={!hydrated} fullWidth>
        Save new password
      </Button>
    </form>
  );
}

/** After the reset, or when the link has expired or was already used. */
export function ResetResult({ expired }: { expired: boolean }) {
  return expired ? (
    <div role="alert" className="flex flex-col gap-4">
      <p className="text-h4">This link doesn&apos;t work any more</p>
      <p className="text-muted-foreground">
        Reset links work once, for 30 minutes. Ask for a new one.
      </p>
      <Link href="/forgot-password" className={buttonClasses({ fullWidth: true })}>
        Send me a new link
      </Link>
    </div>
  ) : (
    <div role="status" className="flex flex-col gap-4">
      <p className="text-h4">Your password is changed</p>
      <p className="text-muted-foreground">
        For your safety, you&apos;ve been signed out everywhere. Sign in with your new password.
      </p>
      <Link href="/sign-in" className={buttonClasses({ fullWidth: true })}>
        Sign in
      </Link>
    </div>
  );
}
