import "server-only";
import { serverEnv } from "@/lib/env.server";

/**
 * Order alerts for the team: always one structured line in the server log
 * ("[orders:alert] …", easy to search and to alarm on), plus a message to
 * ALERT_WEBHOOK_URL (Slack/Teams incoming webhook) when one is configured.
 * Sending an alert never throws: a broken webhook must not break ordering.
 */

export type OrderAlert = {
  /** e.g. "rejected", "gave_up", "failing", "erp_config" */
  kind: string;
  orderNumber: string;
  message: string;
  detail?: string;
};

export async function sendOrderAlert(alert: OrderAlert): Promise<void> {
  console.error(`[orders:alert] ${JSON.stringify(alert)}`);

  const url = serverEnv().ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `:warning: Order ${alert.orderNumber}: ${alert.message}${alert.detail ? `\n${alert.detail}` : ""}`,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("[orders:alert] webhook failed", error);
  }
}
