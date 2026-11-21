"use client";

import type { ComponentProps } from "react";
import { cx } from "@/lib/utils";
import { useFieldControlProps } from "./FormField";

/** Shared look for text inputs, selects and textareas. */
export const controlClasses = cx(
  "w-full rounded-sm border border-border-strong bg-surface px-3 text-body text-foreground",
  "placeholder:text-muted-foreground",
  "focus-visible:border-ring",
  "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60",
  "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger",
);

/** Text input. Put it inside <FormField> for a label and error message. */
export function Input({ className, ...props }: ComponentProps<"input">) {
  const fieldProps = useFieldControlProps(props);
  return <input {...props} {...fieldProps} className={cx(controlClasses, "h-11", className)} />;
}

/** Multi-line text input. Put it inside <FormField> for a label and error message. */
export function Textarea({ className, rows = 4, ...props }: ComponentProps<"textarea">) {
  const fieldProps = useFieldControlProps(props);
  return (
    <textarea
      rows={rows}
      {...props}
      {...fieldProps}
      className={cx(controlClasses, "min-h-24 py-2.5", className)}
    />
  );
}
