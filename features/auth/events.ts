"use client";

import { useCartStore } from "@/features/cart/store";
import { getQueryClient } from "@/lib/query-client";

/**
 * Keeps every open tab in step with sign-in (BUN-186): signing in or out in
 * one tab tells the others (BroadcastChannel), which reload with the new
 * session. Signing out also forgets this browser's copy of the account's cart.
 */
const CHANNEL = "buntalk-auth";
export type AuthEvent = "signed-in" | "signed-out";
/** This tab, so it ignores its own messages (every BroadcastChannel in a tab hears the others). */
const TAB = Math.random().toString(36).slice(2);

export function announce(event: AuthEvent) {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage({ event, from: TAB });
    channel.close();
  } catch {
    // Older browsers: other tabs catch up on their next page load.
  }
}

/** What changes in this browser when the customer signs out. */
export function forgetAccountState() {
  // The cart belonged to the account (saved on the server); don't keep or re-save it as a guest's.
  useCartStore.getState().applyServer([], null);
  getQueryClient().clear();
}

export function listen(onEvent: (event: AuthEvent) => void): () => void {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = ({ data }) => {
      if (data?.from === TAB) return;
      if (data?.event === "signed-in" || data?.event === "signed-out") onEvent(data.event);
    };
    return () => channel.close();
  } catch {
    return () => {};
  }
}
