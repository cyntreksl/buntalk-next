"use client";

import { useEffect } from "react";
import { syncCartNow } from "@/features/cart/CartSync";
import { getQueryClient } from "@/lib/query-client";
import { announce } from "./events";

/**
 * Signed in by a link (the email confirmation, BUN-187) rather than the form:
 * load the account's cart, refresh the header and tell other open tabs.
 */
export function SignedInHere() {
  useEffect(() => {
    void syncCartNow();
    void getQueryClient().invalidateQueries({ queryKey: ["session"] });
    announce("signed-in");
  }, []);
  return null;
}
