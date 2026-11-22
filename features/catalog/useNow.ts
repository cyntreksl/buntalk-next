"use client";

import { useSyncExternalStore } from "react";

/**
 * The current time, refreshed every 15 seconds. On the server (and during
 * hydration) it's null: offers are then shown as the cached page has them.
 * In the browser, offers outside their start/end time are hidden within
 * seconds, even if the cached page is a few minutes old.
 */
const TICK_MS = 15_000;
let now = Date.now();
const subscribe = (onChange: () => void) => {
  now = Date.now();
  const id = setInterval(() => {
    now = Date.now();
    onChange();
  }, TICK_MS);
  return () => clearInterval(id);
};
// Returns the stored value (not Date.now()), so React sees the same time until the next tick.
export const useNow = () =>
  useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
