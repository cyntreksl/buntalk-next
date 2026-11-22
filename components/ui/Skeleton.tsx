import { cx } from "@/lib/utils";

/**
 * Grey placeholder shown while content loads. Size it with classes,
 * e.g. <Skeleton className="h-6 w-40" />. Hidden from screen readers; put a
 * visually hidden "Loading…" message (or role="status") on the surrounding area.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "bg-surface-muted block animate-pulse rounded-sm motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/** Ready-made skeleton for a product card. */
export function ProductCardSkeleton() {
  return (
    // Same shape as the product card: square photo, name, price, button.
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="mt-1 h-4 w-3/4" />
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="mt-1 h-9 w-full rounded-full" />
    </div>
  );
}
