"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button, FormField, Input } from "@/components/ui";
import { syncCartNow } from "@/features/cart/CartSync";
import { authClient } from "@/lib/auth/client";
import { passwordChecks, passwordProblem, PASSWORD_MAX } from "@/lib/auth/password";
import { usernameProblem } from "@/lib/auth/username";
import { getQueryClient } from "@/lib/query-client";
import { cx } from "@/lib/utils";
import type { AuthMode } from "./dialog";
import { announce } from "./events";

type AuthError = { code?: string; status?: number; message?: string } | null;

/**
 * The customer-facing message for a sign-in error. Wrong details always get
 * the same message, whether or not the account exists (BUN-187).
 */
export function authErrorMessage(error: AuthError): string {
  switch (error?.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
    case "INVALID_USERNAME_OR_PASSWORD":
    case "INVALID_PASSWORD":
    case "USER_NOT_FOUND":
    case "CREDENTIAL_ACCOUNT_NOT_FOUND":
      return "Those details don't match an account. Check them and try again.";
    case "EMAIL_NOT_VERIFIED":
      return "Please confirm your email first. We've sent you a new link: open it to sign in.";
    case "PASSWORD_TOO_WEAK":
      return error?.message ?? "Choose a stronger password.";
    case "PASSWORD_TOO_SHORT":
      return "Use at least 8 characters for your password.";
    case "PASSWORD_TOO_LONG":
      return `Use at most ${PASSWORD_MAX} characters for your password.`;
    case "INVALID_EMAIL":
      return "Enter a valid email address.";
    case "USERNAME_IS_ALREADY_TAKEN":
      return "That username is taken. Choose another one.";
    case "USERNAME_TOO_SHORT":
    case "USERNAME_TOO_LONG":
    case "INVALID_USERNAME":
      return "Use 3 to 30 letters, numbers, dots or underscores for your username.";
  }
  if (error?.status === 429) return "Too many tries. Please wait a few minutes and try again.";
  return "Something went wrong. Please try again.";
}

/** The email-confirmation link brings the customer here, signed in, then on to `next`. */
const verifiedUrl = (next: string) => `/email-verified?${new URLSearchParams({ next })}`;

/** The rules, ticked off while the customer types a new password. */
function PasswordRules({ password, email, username }: Record<string, string>) {
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

/** After signing up: the confirmation email is on its way. */
function CheckEmail({ email, next, onBack }: { email: string; next: string; onBack: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function resend() {
    setState("sending");
    const result = await authClient.sendVerificationEmail({
      email,
      callbackURL: verifiedUrl(next),
    });
    setState(result.error ? "error" : "sent");
  }
  return (
    <div role="status" className="flex flex-col gap-4">
      <p className="text-h4">Check your email</p>
      <p>
        We&apos;ve sent a link to <strong>{email}</strong>. Open it to confirm your email and
        you&apos;ll be signed in. The link works for 24 hours.
      </p>
      <p className="text-body-sm text-muted-foreground">
        Nothing there? Check your spam folder, or send it again.
      </p>
      {state === "sent" && (
        <p className="text-body-sm text-success font-semibold">We&apos;ve sent it again.</p>
      )}
      {state === "error" && (
        <p role="alert" className="text-body-sm text-danger font-semibold">
          We couldn&apos;t send it right now. Please wait a few minutes and try again.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={resend} loading={state === "sending"}>
          Send it again
        </Button>
        <Button variant="ghost" size="sm" onClick={onBack}>
          Use a different email
        </Button>
      </div>
    </div>
  );
}

/**
 * Sign in or create an account (BUN-186, BUN-187), shared by the sign-in
 * pages and the sign-in dialog.
 *
 * - **Sign up:** name, email, an optional username and a password, with the
 *   password rules ticked off while typing. Then "check your email": the
 *   account is used only after the email is confirmed (the link signs in).
 * - **Sign in:** email or username, and the password.
 *
 * After signing in, the guest cart has already joined the account's cart on
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState({ email: "", username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const signingUp = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    // After the email is confirmed: back where they were (dialog), or to `next` (pages).
    const goTo = next ?? `${window.location.pathname}${window.location.search}`;
    setError(null);

    if (signingUp) {
      const email = String(form.get("email") ?? "").trim();
      const username = String(form.get("username") ?? "").trim();
      const problems: Record<string, string> = {};
      const passwordIssue = passwordProblem(password, { email, username });
      if (passwordIssue) problems.password = passwordIssue;
      const usernameIssue = username ? usernameProblem(username) : null;
      if (usernameIssue) problems.username = usernameIssue;
      setFieldErrors(problems);
      if (Object.keys(problems).length > 0) return;

      setPending(true);
      const result = await authClient.signUp.email({
        name: String(form.get("name") ?? "").trim(),
        email,
        password,
        ...(username ? { username } : {}),
        callbackURL: verifiedUrl(goTo),
      });
      setPending(false);
      if (result.error) {
        setError(authErrorMessage(result.error));
        return;
      }
      // The same answer whether or not the email already had an account (BUN-187).
      setSentTo(email);
      return;
    }

    const identifier = String(form.get("identifier") ?? "").trim();
    setPending(true);
    const result = identifier.includes("@")
      ? await authClient.signIn.email({
          email: identifier,
          password,
          callbackURL: verifiedUrl(goTo),
        })
      : await authClient.signIn.username({ username: identifier, password });
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

  if (sentTo) {
    return (
      <CheckEmail
        email={sentTo}
        next={next ?? "/account"}
        onBack={() => {
          setSentTo(null);
          setError(null);
        }}
      />
    );
  }

  const switchTo = (target: AuthMode, label: string) =>
    onModeChange ? (
      <button
        type="button"
        onClick={() => {
          setError(null);
          setFieldErrors({});
          onModeChange(target);
        }}
        className="text-primary font-semibold underline"
      >
        {label}
      </button>
    ) : (
      <Link
        href={
          next && next !== "/account" ? `/${target}?${new URLSearchParams({ next })}` : `/${target}`
        }
        className="text-primary font-semibold underline"
      >
        {label}
      </Link>
    );

  const set = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {signingUp ? (
        <>
          <FormField label="Your name" required>
            <Input name="name" autoComplete="name" required maxLength={120} />
          </FormField>
          <FormField label="Email" required>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={values.email}
              onChange={set("email")}
            />
          </FormField>
          <FormField
            label="Username (optional)"
            hint="Sign in with it instead of your email. Letters, numbers, dots or underscores."
            error={fieldErrors.username}
          >
            <Input
              name="username"
              autoComplete="username"
              maxLength={30}
              value={values.username}
              onChange={set("username")}
            />
          </FormField>
        </>
      ) : (
        <FormField label="Email or username" required>
          <Input name="identifier" autoComplete="username" required maxLength={254} />
        </FormField>
      )}
      <FormField label="Password" required error={fieldErrors.password}>
        <div className="flex gap-2">
          <Input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={signingUp ? "new-password" : "current-password"}
            required
            minLength={signingUp ? 8 : undefined}
            maxLength={PASSWORD_MAX}
            value={values.password}
            onChange={set("password")}
            className="flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={showPassword}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "Hide" : "Show"}
          </Button>
        </div>
      </FormField>
      {signingUp && (
        <PasswordRules password={values.password} email={values.email} username={values.username} />
      )}
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
