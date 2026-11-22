"use client";

import { Badge } from "@/components/ui";
import type { ProductOffer } from "@/lib/erp";
import { isWithinWindow, offerValidity } from "@/lib/offers";
import { cx, formatPrice } from "@/lib/utils";
import { useNow } from "./useNow";

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

/**
 * Offers on the product page: badge, name, description, conditions and when
 * it ends ("Ends today at 6:00 pm", "Valid until Sat 28 Nov", Sri Lanka time).
 * Each disappears by itself when it ends.
 */
export function OfferList({ offers, currency }: { offers: ProductOffer[]; currency: string }) {
  const now = useNow();
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
              offerValidity(o, now),
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
