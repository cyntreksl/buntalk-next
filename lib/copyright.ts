import "server-only";
import { cacheLife } from "next/cache";
import { siteConfig } from "@/lib/site-config";

/**
 * "2023 – 2026" for the footer copyright line. Cached (refreshed daily) so
 * the current year can be shown on prerendered pages.
 */
export async function getCopyrightYears(): Promise<string> {
  "use cache";
  cacheLife("days");
  const year = new Date().getFullYear();
  const start = siteConfig.copyrightStartYear;
  return year > start ? `${start} – ${year}` : String(year);
}
