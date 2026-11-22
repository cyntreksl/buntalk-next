/**
 * Order status for customers (BUN-165). Pure, usable on the server and in
 * the browser.
 *
 * The ERP sends its fulfilment status (contract enum below). Customers see
 * friendly words that depend on delivery or pickup, and a step-by-step
 * timeline. Before the ERP has the order, it is simply "Order received".
 */

export const ERP_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "dispatched",
  "completed",
  "cancelled",
] as const;

export type ErpOrderStatus = (typeof ERP_ORDER_STATUSES)[number];
export type FulfilmentType = "delivery" | "pickup";

/** Statuses after which nothing changes any more (no more polling). */
export const FINAL_STATUSES: ReadonlySet<ErpOrderStatus> = new Set(["completed", "cancelled"]);

type Label = { title: string; description: string };

export function statusLabel(status: ErpOrderStatus | null, type: FulfilmentType): Label {
  switch (status) {
    case null:
    case "pending":
      return {
        title: "Order received",
        description: "We've got your order and will confirm it shortly.",
      };
    case "confirmed":
      return { title: "Order confirmed", description: "Our bakery has accepted your order." };
    case "preparing":
      return { title: "Being prepared", description: "Our bakers are preparing your order." };
    case "ready":
      return type === "pickup"
        ? { title: "Ready to collect", description: "Your order is ready at the outlet." }
        : {
            title: "Ready for delivery",
            description: "Your order is packed and waiting for a rider.",
          };
    case "dispatched":
      return { title: "Out for delivery", description: "Your order is on its way to you." };
    case "completed":
      return type === "pickup"
        ? { title: "Collected", description: "You've collected your order. Enjoy!" }
        : { title: "Delivered", description: "Your order has been delivered. Enjoy!" };
    case "cancelled":
      return {
        title: "Cancelled",
        description: "This order was cancelled. Contact us if you have any questions.",
      };
  }
}

export type TimelineStep = {
  key: ErpOrderStatus;
  title: string;
  state: "done" | "current" | "upcoming";
};

/**
 * The steps to show on the order page. Delivery has an "Out for delivery"
 * step; pickup doesn't. A cancelled order shows the steps it reached, then
 * "Cancelled".
 */
export function statusTimeline(
  status: ErpOrderStatus | null,
  type: FulfilmentType,
  reachedBeforeCancel: ErpOrderStatus | null = null,
): TimelineStep[] {
  const steps: ErpOrderStatus[] =
    type === "delivery"
      ? ["pending", "confirmed", "preparing", "ready", "dispatched", "completed"]
      : ["pending", "confirmed", "preparing", "ready", "completed"];

  if (status === "cancelled") {
    const reached = reachedBeforeCancel ? steps.indexOf(reachedBeforeCancel) : 0;
    return [
      ...steps.slice(0, Math.max(reached, 0) + 1).map((key) => ({
        key,
        title: statusLabel(key, type).title,
        state: "done" as const,
      })),
      { key: "cancelled", title: "Cancelled", state: "current" },
    ];
  }

  const current = steps.indexOf(status ?? "pending");
  return steps.map((key, i) => ({
    key,
    title: statusLabel(key, type).title,
    state:
      i < current
        ? "done"
        : i === current
          ? key === "completed"
            ? "done"
            : "current"
          : "upcoming",
  }));
}
