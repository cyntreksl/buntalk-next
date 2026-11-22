import type { ReactNode } from "react";
import { cx } from "@/lib/utils";

type EmptyStateProps = {
  /** Decorative icon (hidden from screen readers). */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or links, e.g. "Start shopping". */
  actions?: ReactNode;
  /** Extra content under the actions, e.g. popular categories. */
  children?: ReactNode;
  /** Heading level for the title; pick the one that fits the page outline. */
  headingLevel?: "h1" | "h2" | "h3";
  className?: string;
};

/**
 * Friendly placeholder for "nothing here yet" (empty cart, no search
 * results, no orders) and for error and 404 pages. Always says what happened
 * and offers a next step.
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  children,
  headingLevel: Heading = "h2",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        "border-border bg-surface flex flex-col items-center gap-4 rounded-lg border px-6 py-10 text-center md:py-14",
        className,
      )}
    >
      {icon && (
        <span
          aria-hidden="true"
          className="bg-accent-soft text-accent-soft-foreground flex size-16 items-center justify-center rounded-full"
        >
          {icon}
        </span>
      )}
      <div className="flex max-w-prose flex-col gap-2">
        <Heading className={Heading === "h1" ? "text-h1" : "text-h3"}>{title}</Heading>
        {description && <div className="text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap justify-center gap-3">{actions}</div>}
      {children && <div className="w-full max-w-prose">{children}</div>}
    </div>
  );
}
