"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cx } from "@/lib/utils";

type ChoiceProps = Omit<ComponentProps<"input">, "type"> & {
  label: ReactNode;
  /** Extra text under the label. */
  description?: ReactNode;
  /** Error message for this single checkbox (e.g. "Please accept the terms"). */
  error?: ReactNode;
};

function Choice({
  type,
  label,
  description,
  error,
  id: idProp,
  className,
  disabled,
  ...props
}: ChoiceProps & { type: "checkbox" | "radio" }) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type={type}
          disabled={disabled}
          aria-describedby={[descriptionId, errorId].filter(Boolean).join(" ") || undefined}
          aria-invalid={error ? true : undefined}
          className="accent-primary border-border-strong mt-0.5 size-5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
          {...props}
        />
        <div className="flex flex-col">
          <label
            htmlFor={id}
            className={cx(
              "text-body cursor-pointer",
              disabled && "text-muted-foreground cursor-not-allowed",
            )}
          >
            {label}
          </label>
          {description && (
            <p id={descriptionId} className="text-body-sm text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-body-sm text-danger pl-8 font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}

/** Checkbox with its own label. */
export function Checkbox(props: ChoiceProps) {
  return <Choice type="checkbox" {...props} />;
}

/** Single radio option. Group options with <RadioGroup> and give them the same name. */
export function Radio(props: ChoiceProps) {
  return <Choice type="radio" {...props} />;
}

type RadioGroupProps = {
  legend: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/** A labelled set of radio options (fieldset + legend), with an optional error. */
export function RadioGroup({
  legend,
  hint,
  error,
  required,
  className,
  children,
}: RadioGroupProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <fieldset
      aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
      aria-invalid={error ? true : undefined}
      aria-required={required || undefined}
      className={cx("flex flex-col gap-3", className)}
    >
      <legend className="text-body-sm text-foreground mb-1 font-bold">
        {legend}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </legend>
      {hint && (
        <p id={hintId} className="text-body-sm text-muted-foreground -mt-2">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={errorId} role="alert" className="text-body-sm text-danger font-semibold">
          {error}
        </p>
      )}
    </fieldset>
  );
}
