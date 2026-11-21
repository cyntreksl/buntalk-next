import type { ComponentProps } from "react";
import { cx } from "@/lib/utils";

type CardProps = ComponentProps<"div"> & {
  padding?: "none" | "sm" | "md" | "lg";
  /** Lifts on hover. Use when the whole card is a link. */
  interactive?: boolean;
};

const paddings = { none: "", sm: "p-3", md: "p-4 md:p-5", lg: "p-6 md:p-8" };

/** Surface for grouping content: product tiles, order summaries, panels. */
export function Card({ padding = "md", interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cx(
        "border-border bg-surface rounded-lg border shadow-xs",
        paddings[padding],
        interactive && "hover:border-border-strong transition-shadow hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cx("text-h4", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cx("text-body-sm text-muted-foreground", className)} {...props} />;
}
