"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

/**
 * True once the page's scripts are running. Sign-in and password forms keep
 * their submit button disabled until then: a form submitted by the browser
 * itself (before the scripts load, on a slow connection) would otherwise go
 * nowhere useful. The forms also use method="post", so even then the
 * password is never put in the address bar.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}
