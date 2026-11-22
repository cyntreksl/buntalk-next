import { CheckCircleIcon } from "@/components/ui";
import {
  statusLabel,
  statusTimeline,
  type ErpOrderStatus,
  type FulfilmentType,
} from "@/lib/orders/status";
import { cx } from "@/lib/utils";

const updatedFormat = new Intl.DateTimeFormat("en-LK", {
  timeZone: "Asia/Colombo",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * The order's current status in customer words, with a step-by-step
 * timeline (delivery: … → Out for delivery → Delivered; pickup: … → Ready to
 * collect → Collected). Used by the order page; the account order pages
 * (BUN-194) reuse it.
 */
export function OrderStatusCard({
  status,
  type,
  changedAt,
  reachedBeforeCancel,
}: {
  status: ErpOrderStatus | null;
  type: FulfilmentType;
  changedAt: Date | null;
  reachedBeforeCancel?: ErpOrderStatus | null;
}) {
  const label = statusLabel(status, type);
  const steps = statusTimeline(status, type, reachedBeforeCancel ?? null);
  const cancelled = status === "cancelled";

  return (
    <section
      aria-labelledby="order-status"
      className="bg-surface-muted flex flex-col gap-5 rounded-2xl p-5 md:p-7"
    >
      <div className="flex flex-col gap-1" aria-live="polite">
        <p className="text-caption text-muted-foreground font-bold tracking-wider uppercase">
          Order status
        </p>
        <h2 id="order-status" className={cx("text-h2", cancelled && "text-danger")}>
          {label.title}
        </h2>
        <p className="text-muted-foreground">{label.description}</p>
        {changedAt && (
          <p className="text-body-sm text-muted-foreground">
            Updated {updatedFormat.format(changedAt)}
          </p>
        )}
      </div>

      <ol className="flex flex-col gap-0 md:flex-row md:gap-2">
        {steps.map((step, i) => (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className="flex flex-1 items-start gap-3 md:flex-col md:items-center md:text-center"
          >
            <div className="flex flex-col items-center md:w-full md:flex-row">
              <span
                className={cx(
                  "hidden h-0.5 flex-1 md:block",
                  i === 0
                    ? "invisible"
                    : step.state === "upcoming"
                      ? "bg-border-strong"
                      : "bg-primary",
                )}
              />
              <span
                className={cx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  step.state === "done" && "bg-primary text-primary-foreground",
                  step.state === "current" &&
                    (step.key === "cancelled"
                      ? "bg-danger text-background"
                      : "bg-primary text-primary-foreground ring-accent ring-4"),
                  step.state === "upcoming" && "bg-surface border-border-strong border-2",
                )}
              >
                {step.state !== "upcoming" && <CheckCircleIcon size={16} />}
              </span>
              <span
                className={cx(
                  "h-6 w-0.5 md:hidden",
                  i === steps.length - 1
                    ? "invisible"
                    : step.state === "upcoming"
                      ? "bg-border-strong"
                      : "bg-primary",
                )}
              />
              <span
                className={cx(
                  "hidden h-0.5 flex-1 md:block",
                  i === steps.length - 1
                    ? "invisible"
                    : steps[i + 1]?.state === "upcoming"
                      ? "bg-border-strong"
                      : "bg-primary",
                )}
              />
            </div>
            <span
              className={cx(
                "text-body-sm pt-0.5 md:pt-2",
                step.state === "upcoming" ? "text-muted-foreground" : "text-foreground font-bold",
              )}
            >
              {step.title}
              <span className="sr-only">
                {step.state === "done" ? " (done)" : step.state === "current" ? " (current)" : ""}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
