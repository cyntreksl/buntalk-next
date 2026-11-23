"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { authClient } from "@/lib/auth/client";
import { useHydrated } from "./useHydrated";
import { passwordProblem } from "@/lib/auth/password";
import { authErrorMessage } from "./AuthForm";
import { PasswordInput, PasswordRules } from "./PasswordFields";

/**
 * Change password from the account page (BUN-188): the current password and
 * a new one. The customer stays signed in here; every other device is
 * signed out, and the owner gets an email.
 */
export function ChangePasswordForm({ email }: { email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pending, setPending] = useState(false);
  const hydrated = useHydrated();
  const [errors, setErrors] = useState<{ current?: string; next?: string; form?: string }>({});
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = passwordProblem(next, { email });
    if (problem) {
      setErrors({ next: problem });
      return;
    }
    if (next === current) {
      setErrors({ next: "Choose a password you haven't used here." });
      return;
    }
    setPending(true);
    setErrors({});
    const result = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setPending(false);
    if (result.error?.code === "INVALID_PASSWORD") {
      setErrors({ current: "That isn't your current password." });
    } else if (result.error) {
      setErrors({ form: authErrorMessage(result.error) });
    } else {
      setCurrent("");
      setNext("");
      setDone(true);
    }
  }

  return (
    <form method="post" onSubmit={submit} className="flex max-w-md flex-col gap-4">
      <PasswordInput
        label="Current password"
        name="currentPassword"
        value={current}
        onChange={(v) => {
          setCurrent(v);
          setDone(false);
        }}
        autoComplete="current-password"
        error={errors.current}
      />
      <PasswordInput
        label="New password"
        name="newPassword"
        value={next}
        onChange={(v) => {
          setNext(v);
          setDone(false);
        }}
        autoComplete="new-password"
        error={errors.next}
      />
      <PasswordRules password={next} email={email} />
      {errors.form && (
        <p
          role="alert"
          className="bg-danger-soft text-danger text-body-sm rounded-md px-3 py-2 font-semibold"
        >
          {errors.form}
        </p>
      )}
      {done && (
        <p
          role="status"
          className="bg-success-soft text-success text-body-sm rounded-md px-3 py-2 font-semibold"
        >
          Your password is changed. You&apos;ve been signed out on your other devices.
        </p>
      )}
      <Button type="submit" loading={pending} disabled={!hydrated} className="self-start">
        Change password
      </Button>
    </form>
  );
}
