"use client";

import { useEffect } from "react";
import { forgetAccountState, listen } from "./events";

/** Signing in or out in another tab: this tab follows (BUN-186). Mounted once, in Providers. */
export function AuthSync() {
  useEffect(
    () =>
      listen((event) => {
        if (event === "signed-out") forgetAccountState();
        window.location.reload();
      }),
    [],
  );
  return null;
}
