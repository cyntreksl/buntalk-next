"use client";

import { createContext, useContext, useId, type AriaAttributes, type ReactNode } from "react";
import { cx } from "@/lib/utils";

type FieldContextValue = {
  id: string;
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

/**
 * Wires a control inside <FormField> to its label, hint and error message.
 * Input, Select and Textarea call this automatically.
 */
export function useFormField() {
  return useContext(FieldContext);
}

/** Props a control should spread to connect itself to the surrounding FormField. */
export function useFieldControlProps(
  props: Pick<AriaAttributes, "aria-describedby" | "aria-invalid"> & {
    id?: string;
    required?: boolean;
  },
) {
  const field = useFormField();
  return {
    id: props.id ?? field?.id,
    "aria-describedby":
      [props["aria-describedby"], field?.describedBy].filter(Boolean).join(" ") || undefined,
    "aria-invalid": props["aria-invalid"] ?? (field?.invalid || undefined),
    required: props.required ?? field?.required,
  };
}

type FormFieldProps = {
  label: ReactNode;
  /** Help text shown under the label. */
  hint?: ReactNode;
  /** Error message. When set, the control is marked invalid and the message is announced. */
  error?: ReactNode;
  required?: boolean;
  /** Use for a control whose id you set yourself. */
  id?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Label + control + hint + error message, wired together for screen readers.
 *
 *   <FormField label="Email" hint="We'll send the receipt here" error={errors.email} required>
 *     <Input type="email" name="email" />
 *   </FormField>
 */
export function FormField({
  label,
  hint,
  error,
  required = false,
  id: idProp,
  className,
  children,
}: FormFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
      <div className={cx("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className="text-body-sm text-foreground font-bold">
          {label}
          {required && (
            <span className="text-danger" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </label>
        {hint && (
          <p id={hintId} className="text-body-sm text-muted-foreground">
            {hint}
          </p>
        )}
        {children}
        {error && (
          <p id={errorId} role="alert" className="text-body-sm text-danger font-semibold">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
