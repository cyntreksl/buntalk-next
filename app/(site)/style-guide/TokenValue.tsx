"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  // Re-read when the colour scheme changes (light/dark).
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** Shows the current value of a CSS variable, read from the live stylesheet. */
export function TokenValue({ name }: { name: string }) {
  const value = useSyncExternalStore(
    subscribe,
    () => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    () => "",
  );
  return <code className="text-caption text-muted-foreground font-mono">{value || " "}</code>;
}
