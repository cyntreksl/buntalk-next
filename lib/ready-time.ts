/**
 * "Earliest ready" text for the product page (BUN-171), from the ERP's
 * preparation time. Delivery slots and cut-off times aren't in the ERP yet
 * (BUN-251), so this is the earliest the bakery can have it ready; checkout
 * confirms the actual delivery time.
 */

export const STORE_TIME_ZONE = "Asia/Colombo";

const dayKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(date)
    .split("-")
    .map(Number);

/** Whole calendar days from `from` to `to`, in the store's time zone. */
function daysBetween(from: Date, to: Date, timeZone: string): number {
  const [y1, m1, d1] = dayKey(from, timeZone);
  const [y2, m2, d2] = dayKey(to, timeZone);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/**
 * "today, from about 3:00 pm", "tomorrow, from about 9:30 am" or
 * "on Tue, 24 Nov". Times are shown only when it's ready within a day.
 */
export function earliestReadyLabel(
  processingHours: number,
  now: Date = new Date(),
  timeZone: string = STORE_TIME_ZONE,
): string {
  const ready = new Date(now.getTime() + processingHours * 3_600_000);
  const days = daysBetween(now, ready, timeZone);
  const time = new Intl.DateTimeFormat("en-LK", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(ready)
    .toLowerCase();
  if (days === 0) return `today, from about ${time}`;
  if (days === 1) return `tomorrow, from about ${time}`;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(ready);
  return `on ${date}`;
}
