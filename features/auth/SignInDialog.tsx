"use client";

import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui";
import { AuthForm } from "./AuthForm";
import { useAuthDialog } from "./dialog";

/**
 * The shared sign-in / sign-up dialog (BUN-186), so customers can sign in
 * without leaving the page they're on (header, checkout). Mounted once, in
 * Providers; open it with `useAuthDialog.getState().show()`.
 */
export function SignInDialog() {
  const router = useRouter();
  const { open, mode, next, setMode, close } = useAuthDialog();
  return (
    <Dialog
      open={open}
      onClose={close}
      title={mode === "sign-up" ? "Create your account" : "Sign in"}
      description={
        mode === "sign-up"
          ? "Order faster, track your orders and keep your cart on every device."
          : "Welcome back. Your cart comes with you."
      }
    >
      {open && (
        <AuthForm
          mode={mode}
          onModeChange={setMode}
          onDone={() => {
            close();
            if (next) router.push(next);
            router.refresh();
          }}
        />
      )}
    </Dialog>
  );
}
