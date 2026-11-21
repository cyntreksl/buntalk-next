"use client";

import { useId } from "react";
import { cx } from "@/lib/utils";
import { MinusIcon, PlusIcon } from "./icons";

type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Read by screen readers, e.g. "Quantity of Sample Product 1". */
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
};

/** − [ 2 ] + control for quantities. Typing a number also works; values are kept within min/max. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label = "Quantity",
  disabled = false,
  size = "md",
  className,
}: QuantityStepperProps) {
  const id = useId();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const height = size === "sm" ? "h-9" : "h-11";
  const buttonClasses = cx(
    "inline-flex aspect-square items-center justify-center text-foreground hover:bg-surface-muted",
    "disabled:cursor-not-allowed disabled:opacity-40",
    height,
  );

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className={cx(
        "border-border-strong bg-surface inline-flex items-center overflow-hidden rounded-md border",
        disabled && "opacity-60",
        className,
      )}
    >
      <span id={`${id}-label`} className="sr-only">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease quantity"
        className={buttonClasses}
      >
        <MinusIcon size={18} />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          const n = Number.parseInt(event.target.value, 10);
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        className={cx(
          "text-body w-12 [appearance:textfield] bg-transparent text-center font-bold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          height,
        )}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase quantity"
        className={buttonClasses}
      >
        <PlusIcon size={18} />
      </button>
    </div>
  );
}
