import { discountPercent, isOnOffer } from "@/lib/pricing";
import { cx, formatPrice } from "@/lib/utils";

type PriceProps = {
  price: number;
  compareAtPrice?: number;
  currency: string;
  size?: "sm" | "lg";
  className?: string;
};

/** Price, with the original price struck through when on offer. Screen readers hear "Was … now …". */
export function Price({ price, compareAtPrice, currency, size = "sm", className }: PriceProps) {
  const onOffer = isOnOffer({ price, compareAtPrice });
  const current = formatPrice(price, currency);
  return (
    <p className={cx("flex flex-wrap items-baseline gap-x-2", className)}>
      {onOffer && (
        <span className="sr-only">Was {formatPrice(compareAtPrice!, currency)}, now</span>
      )}
      <span
        className={cx(
          "text-primary font-bold",
          size === "lg" ? "font-display text-h2" : "text-body",
        )}
      >
        {current}
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
