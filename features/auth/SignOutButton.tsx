"use client";

import { useState } from "react";
import { Button, toast } from "@/components/ui";
import { authClient } from "@/lib/auth/client";
import { announce, forgetAccountState } from "./events";

/**
 * Sign out (BUN-186). The session is deleted on the server, so its cookie
 * stops working at once; other open tabs follow, and this browser forgets
 * the account's cart. `everywhere` also ends the customer's sessions on all
 * their other devices.
 */
export function SignOutButton({
  everywhere = false,
  className,
  variant = "outline",
}: {
  everywhere?: boolean;
  className?: string;
  variant?: "outline" | "ghost";
}) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    if (everywhere) {
      const revoked = await authClient.revokeSessions();
      if (revoked.error) {
        setPending(false);
        toast.error("Couldn't sign out", "Please try again.");
        return;
      }
    }
    await authClient.signOut();
    forgetAccountState();
    announce("signed-out");
    // A full page load, so nothing from the signed-in session stays in memory.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  return (
    <Button variant={variant} size="sm" onClick={signOut} loading={pending} className={className}>
      {everywhere ? "Sign out on all devices" : "Sign out"}
    </Button>
  );
}
