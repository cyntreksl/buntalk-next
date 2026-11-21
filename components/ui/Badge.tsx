import type { ComponentProps } from "react";
import { cx } from "@/lib/utils";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-foreground",
  brand: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

/** Short status label: "New", "Sold out", "Paid". Don't use colour alone to carry meaning — the text must say it. */
export function Badge({
  tone = "neutral",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: BadgeTone }) {
  return (
    <span
      className={cx(
        "text-caption inline-flex items-center rounded-full px-2.5 py-0.5 font-bold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
