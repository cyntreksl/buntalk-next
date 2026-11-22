import "server-only";
import { serverEnv } from "@/lib/env.server";

/**
 * Alerts for the team (orders, customer sync …): always one structured line
 * in the server log ("[alert] …", easy to search and to alarm on), plus a
 * message to ALERT_WEBHOOK_URL (Slack/Teams incoming webhook) when one is
 * configured. Sending an alert never throws: a broken webhook must not break
 * ordering or sign-up.
 */

export type TeamAlert = {
  /** Area: "orders", "customers" … */
  area: string;
  /** e.g. "rejected", "gave_up", "conflict" */
  kind: string;
  /** What it's about, e.g. an order number or a customer id. */
  subject: string;
  message: string;
  detail?: string;
};

export async function sendTeamAlert(alert: TeamAlert): Promise<void> {
  console.error(`[${alert.area}:alert] ${JSON.stringify(alert)}`);

  const url = serverEnv().ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `:warning: [${alert.area}] ${alert.subject}: ${alert.message}${alert.detail ? `\n${alert.detail}` : ""}`,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error(`[${alert.area}:alert] webhook failed`, error);
  }
}
