"use client";

import { Badge } from "@/components/ui";
import type { ProductOffer } from "@/lib/erp";
import { displayPrice } from "@/lib/offers";
import { discountPercent } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import { usePersonalPrice } from "./CustomerPrices";
import { Price } from "./Price";
import { useNow } from "./useNow";

type OfferPriceProps = {
  slug: string;
  /** The size shown (product page); undefined on cards. */
  skuId?: string;
  price: number;
  compareAtPrice?: number;
  currency: string;
  from?: boolean;
  size?: "sm" | "lg";
  /** The product's offers (ERP schemes), to drop an expired discount in the browser. */
  offers?: ProductOffer[];
  /** "You save LKR 30.00 (17%)" under the price (product page). */
  showSaving?: boolean;
  className?: string;
};

/**
 * The price as the ERP gives it, kept correct in the browser (BUN-174):
 * - final price, original price crossed out, and (on the product page) the
 *   saving in rupees and percent;
 * - when the scheme behind a discount ends while the page is open or cached,
 *   the original price comes back within seconds (the cached page itself is
 *   refreshed at the offer's end time);
 * - a signed-in customer with their own price level sees "Your price"
 *   (CustomerPricesProvider, ERP ticket BUN-247).
 */
export function OfferPrice({
  slug,
  skuId,
  price,
  compareAtPrice,
  currency,
  from,
  size = "sm",
  offers,
  showSaving,
  className,
}: OfferPriceProps) {
  const now = useNow();
  const personal = usePersonalPrice(slug, skuId);
  const display = displayPrice({ price, compareAtPrice }, { offers, now, personal });
  const mine = display.yourPrice ? display.price : undefined;
  const saving = display.compareAtPrice !== undefined ? display.compareAtPrice - display.price : 0;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Price
          price={display.price}
          compareAtPrice={display.compareAtPrice}
          currency={currency}
          size={size}
          from={from}
        />
        {mine !== undefined && <Badge tone="info">Your price</Badge>}
      </div>
      {showSaving && saving > 0 && (
        <p className="text-body-sm text-success font-bold">
          You save {formatPrice(saving, currency)} ({discountPercent(display)}%)
        </p>
      )}
    </div>
  );
}
