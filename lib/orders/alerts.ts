import "server-only";
import { sendTeamAlert } from "@/lib/alerts";

/** Order alerts ("[orders:alert] …" in the log, plus ALERT_WEBHOOK_URL). See lib/alerts.ts. */
export type OrderAlert = {
  /** e.g. "rejected", "gave_up", "failing", "erp_config" */
  kind: string;
  orderNumber: string;
  message: string;
  detail?: string;
};

export function sendOrderAlert(alert: OrderAlert): Promise<void> {
  return sendTeamAlert({
    area: "orders",
    kind: alert.kind,
    subject: `Order ${alert.orderNumber}`,
    message: alert.message,
    detail: alert.detail,
  });
}
