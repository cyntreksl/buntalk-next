"use client";

import { useState } from "react";
import { Button, FormField, Input } from "@/components/ui";
import { passwordChecks, PASSWORD_MAX } from "@/lib/auth/password";
import { cx } from "@/lib/utils";

/** The password rules, ticked off while the customer types a new password (BUN-187). */
export function PasswordRules({
  password,
  email,
  username,
}: {
  password: string;
  email?: string;
  username?: string;
}) {
  const checks = passwordChecks(password, { email, username });
  return (
    <ul className="text-caption flex flex-col gap-0.5" aria-label="Password rules">
      {checks.map((c) => (
        <li
          key={c.id}
          className={cx(
            "flex items-center gap-1.5",
            c.ok ? "text-success" : "text-muted-foreground",
          )}
        >
          <span aria-hidden="true">{c.ok ? "✓" : "•"}</span>
          {c.label}
          <span className="sr-only">{c.ok ? " (done)" : " (not yet)"}</span>
        </li>
      ))}
    </ul>
  );
}

/** A password field with Show / Hide. */
export function PasswordInput({
  label,
  name,
  value,
  onChange,
  autoComplete,
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "new-password" | "current-password";
  error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <FormField label={label} required error={error}>
      <div className="flex gap-2">
        <Input
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          maxLength={PASSWORD_MAX}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={show}
          onClick={() => setShow(!show)}
        >
          {show ? "Hide" : "Show"}
        </Button>
      </div>
    </FormField>
  );
}
