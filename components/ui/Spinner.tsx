import { cx } from "@/lib/utils";

type SpinnerProps = {
  size?: "sm" | "md" | "lg";
  /** Read by screen readers. Pass null when a parent already announces the loading state. */
  label?: string | null;
  className?: string;
};

const sizes = { sm: "size-4 border-2", md: "size-6 border-2", lg: "size-10 border-4" };

/** Spinning loader. Inherits the text colour. */
export function Spinner({ size = "md", label = "Loading", className }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className={cx("inline-flex items-center", className)}
    >
      <span
        className={cx(
          "animate-spin rounded-full border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]",
          sizes[size],
        )}
      />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
