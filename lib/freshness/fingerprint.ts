import { createHash } from "node:crypto";
import type { ChangeEvent } from "./events";

/**
 * Fingerprints for the scheduled catalog check (BUN-167). Pure: no I/O.
 *
 * Each catalog item is hashed from its full ERP data (keys sorted, so key
 * order doesn't matter). Any change the storefront shows (price, name,
 * visibility, stock, image, offer …) changes the hash.
 */

export type FingerprintKind = "product" | "category" | "scheme" | "banner";
export type Fingerprints = Map<string, string>; // `${kind}:${key}` → hash

const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value as Record<string, unknown>)
            .sort()
            .map((k) => [k, stable((value as Record<string, unknown>)[k])]),
        )
      : value;

export const hashItem = (item: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(stable(item)))
    .digest("hex")
    .slice(0, 32);

export const fingerprintKey = (kind: FingerprintKind, key: string) => `${kind}:${key}`;

/**
 * The change events between two sets of fingerprints:
 * - a product or category that changed, appeared or disappeared → its own event;
 * - any scheme change → one "schemes" event; any banner change → one "banners" event.
 */
export function diffFingerprints(previous: Fingerprints, current: Fingerprints): ChangeEvent[] {
  const changed = new Set<string>();
  for (const [key, hash] of current) if (previous.get(key) !== hash) changed.add(key);
  for (const key of previous.keys()) if (!current.has(key)) changed.add(key);

  const events: ChangeEvent[] = [];
  let schemes = false;
  let banners = false;
  for (const key of [...changed].sort()) {
    const [kind, ...rest] = key.split(":");
    const id = rest.join(":");
    if (kind === "product") events.push({ type: "product", slug: id });
    else if (kind === "category") events.push({ type: "category", slug: id });
    else if (kind === "scheme") schemes = true;
    else if (kind === "banner") banners = true;
  }
  if (schemes) events.push({ type: "schemes" });
  if (banners) events.push({ type: "banners" });
  return events;
}
