"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-renders the order page from the server every 30 seconds while the order
 * is still open, and when the tab comes back into view, so a status change
 * in the ERP appears without the customer reloading.
 */
export function AutoRefresh({
  active,
  intervalMs = 30_000,
}: {
  active: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active, intervalMs, router]);

  return null;
}
