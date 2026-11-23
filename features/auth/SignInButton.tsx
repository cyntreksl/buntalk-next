"use client";

import { Button } from "@/components/ui";
import { useAuthDialog, type AuthMode } from "./dialog";

/** Opens the shared sign-in dialog, staying on this page (BUN-186). */
export function SignInButton({
  mode = "sign-in",
  children,
}: {
  mode?: AuthMode;
  children: React.ReactNode;
}) {
  const show = useAuthDialog((state) => state.show);
  return (
    <Button variant="outline" size="sm" onClick={() => show(mode)}>
      {children}
    </Button>
  );
}
