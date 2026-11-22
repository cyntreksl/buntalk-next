/**
 * Phone numbers in one format (E.164, +94…) so the same number always
 * matches: in the storefront database, and when the ERP looks a customer up.
 * Pure, usable on the server and in the browser.
 *
 *   "077 123 4567"     → "+94771234567"
 *   "+94 77-123-4567"  → "+94771234567"
 *   "0094771234567"    → "+94771234567"
 */
export function normalizePhone(input: string): string | null {
  const digits = input.trim().replace(/[\s\-().]/g, "");
  let national: string | undefined;
  if (/^\+94\d{9}$/.test(digits)) national = digits.slice(3);
  else if (/^0094\d{9}$/.test(digits)) national = digits.slice(4);
  else if (/^94\d{9}$/.test(digits)) national = digits.slice(2);
  else if (/^0\d{9}$/.test(digits)) national = digits.slice(1);
  if (!national || national.startsWith("0")) return null;
  return `+94${national}`;
}

/** "+94771234567" → "077 123 4567", for showing to customers. */
export function formatPhone(e164: string): string {
  const national = e164.startsWith("+94") ? `0${e164.slice(3)}` : e164;
  return national.length === 10
    ? `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`
    : national;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
