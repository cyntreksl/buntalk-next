import { discountPercent, isOnOffer } from "@/lib/pricing";
import { cx, formatPrice, priceParts } from "@/lib/utils";

type PriceProps = {
  price: number;
  compareAtPrice?: number;
  currency: string;
  size?: "sm" | "lg";
  /** "From LKR 4,500.00": the lowest of several size prices. */
  from?: boolean;
  className?: string;
};

/**
 * Price, with the original price struck through when on offer. The amount is
 * bold with a small currency code ("LKR 4,500.00"). Screen readers hear
 * "Was … now …".
 */
export function Price({
  price,
  compareAtPrice,
  currency,
  size = "sm",
  from,
  className,
}: PriceProps) {
  const onOffer = isOnOffer({ price, compareAtPrice });
  const current = priceParts(price, currency);
  return (
    <p className={cx("flex flex-wrap items-baseline gap-x-2", className)}>
      {onOffer && (
        <span className="sr-only">Was {formatPrice(compareAtPrice!, currency)}, now</span>
      )}
      <span
        className={cx(
          "text-foreground inline-flex items-baseline gap-1 font-extrabold",
          size === "lg" ? "text-h2" : "text-body-lg",
        )}
      >
        {from && <span className="text-body-sm text-muted-foreground font-semibold">From</span>}
        <span
          className={cx(
            "text-muted-foreground font-bold",
            size === "lg" ? "text-body" : "text-caption",
          )}
        >
          {current.currency}
        </span>
        {current.amount}
      </span>
      {onOffer && (
        <s aria-hidden="true" className="text-muted-foreground text-body-sm">
          {formatPrice(compareAtPrice!, currency)}
        </s>
      )}
    </p>
  );
}

/** "Save 20%" badge text, or null when not on offer. */
export function savingsLabel(item: { price: number; compareAtPrice?: number }) {
  const percent = discountPercent(item);
  return percent > 0 ? `Save ${percent}%` : null;
}
