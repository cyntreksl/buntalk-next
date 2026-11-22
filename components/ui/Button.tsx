import type { ComponentProps } from "react";
import { cx } from "@/lib/utils";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
  outline: "border border-border-strong bg-surface text-foreground hover:bg-surface-muted",
  ghost: "text-foreground hover:bg-surface-muted",
  danger: "bg-danger text-background hover:opacity-90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-body-sm gap-1.5",
  md: "h-11 px-5 text-body gap-2",
  lg: "h-13 px-7 text-body-lg gap-2",
};

/**
 * Button styles as a class string. Use it to style a link like a button:
 * <Link href="/cart" className={buttonClasses({ variant: "outline" })}>Cart</Link>
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cx(
    "inline-flex shrink-0 items-center justify-center rounded-full font-bold whitespace-nowrap transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shows a spinner, disables the button and tells screen readers it is busy. */
  loading?: boolean;
};

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading && <Spinner size="sm" label={null} />}
      {children}
    </button>
  );
}
