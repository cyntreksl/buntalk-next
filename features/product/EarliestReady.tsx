"use client";

import { useSyncExternalStore } from "react";
import { ClockIcon } from "@/components/ui";
import { earliestReadyLabel } from "@/lib/ready-time";

// The page is cached, so the date is worked out in the browser. On the server
// (and during hydration) it shows the preparation time instead.
const subscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

/**
 * "Ready in 2 days · Order now and it can be ready on Tue 24 Nov" (BUN-171).
 * Delivery slots aren't in the ERP yet (BUN-251), so checkout confirms the
 * delivery time.
 */
export function EarliestReady({ hours, readyIn }: { hours: number; readyIn: string }) {
  const isClient = useIsClient();
  return (
    <div className="bg-surface-muted flex items-start gap-3 rounded-lg px-4 py-3">
      <ClockIcon size={20} className="text-primary mt-0.5 shrink-0" />
      <p className="text-body-sm">
        <span className="font-bold">Ready in {readyIn}.</span>{" "}
        {isClient ? (
          <>
            Order now and it can be ready <strong>{earliestReadyLabel(hours)}</strong>. You’ll
            choose a delivery or pickup time at checkout.
          </>
        ) : (
          <>You’ll choose a delivery or pickup time at checkout.</>
        )}
      </p>
    </div>
  );
}
