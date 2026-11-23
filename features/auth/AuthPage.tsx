"use client";

import { useRouter } from "next/navigation";
import { AuthForm } from "./AuthForm";
import type { AuthMode } from "./dialog";

/** The sign-in / sign-up form on its own page: goes on to `next` afterwards (BUN-186). */
export function AuthPage({ mode, next }: { mode: AuthMode; next: string }) {
  const router = useRouter();
  return (
    <AuthForm
      mode={mode}
      next={next === "/account" ? undefined : next}
      onDone={() => {
        router.replace(next);
        router.refresh();
      }}
    />
  );
}
