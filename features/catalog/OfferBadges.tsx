"use client";

import { useSyncExternalStore } from "react";
import { Badge } from "@/components/ui";
import type { ProductOffer } from "@/lib/erp";
import { isWithinWindow } from "@/lib/offers";
import { cx, formatPrice } from "@/lib/utils";

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
const useNow = () =>
  useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );

function useCurrentOffers(offers: ProductOffer[] | undefined) {
  const now = useNow();
  return (offers ?? []).filter((o) => (now === null ? true : isWithinWindow(o, now)));
}

/**
 * Small offer badges for a product card: "Save 20%" and the scheme offers
 * ("Buy 2 get 1 free"). They only show while an ERP scheme applies to the
 * product (BUN-170), so "Save 20%" disappears with the scheme that gave it.
 */
export function OfferBadges({
  offers,
  savings,
  className,
}: {
  offers: ProductOffer[] | undefined;
  /** "Save 20%" (from the ERP's compare-at price), or null. */
  savings?: string | null;
  className?: string;
}) {
  const current = useCurrentOffers(offers);
  if (current.length === 0) return null;
  return (
    <div className={cx("flex flex-wrap gap-1", className)}>
      {savings && <Badge tone="brand">{savings}</Badge>}
      {current.map((o) => (
        <Badge key={o.schemeId} tone="brand">
          {o.label}
        </Badge>
      ))}
    </div>
  );
}

const dateFormat = new Intl.DateTimeFormat("en-LK", { day: "numeric", month: "short" });

/** Offers on the product page: badge, name, description, conditions and end date. */
export function OfferList({ offers, currency }: { offers: ProductOffer[]; currency: string }) {
  const current = useCurrentOffers(offers);
  if (current.length === 0) return null;
  return (
    <section aria-label="Offers" className="flex flex-col gap-2">
      {current.map((o) => (
        <div key={o.schemeId} className="bg-accent-soft rounded-md px-4 py-3">
          <p className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{o.label}</Badge>
            <span className="font-bold">{o.name}</span>
          </p>
          {o.description && <p className="text-body-sm mt-1">{o.description}</p>}
          <p className="text-body-sm text-muted-foreground mt-1">
            {[
              o.minSpend ? `On orders over ${formatPrice(o.minSpend, currency)}` : null,
              o.endsAt ? `Ends ${dateFormat.format(new Date(o.endsAt))}` : null,
              "Applied automatically in your cart",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ))}
    </section>
  );
}
