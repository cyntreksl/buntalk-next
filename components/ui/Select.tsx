"use client";

import type { ComponentProps } from "react";
import { cx } from "@/lib/utils";
import { useFieldControlProps } from "./FormField";
import { ChevronDownIcon } from "./icons";
import { controlClasses } from "./Input";

type SelectProps = ComponentProps<"select"> & {
  /** Shown as a disabled first option when nothing is selected. */
  placeholder?: string;
};

/**
 * Dropdown built on the native <select>, so it works with the keyboard,
 * screen readers and phone pickers out of the box.
 */
export function Select({ className, placeholder, children, ...props }: SelectProps) {
  const fieldProps = useFieldControlProps(props);
  return (
    <div className="relative">
      <select
        {...props}
        {...fieldProps}
        className={cx(controlClasses, "h-11 appearance-none pr-10", className)}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDownIcon
        size={18}
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
      />
    </div>
  );
}
