import "server-only";
import { eq, sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import type { Db } from "@/lib/db";
import { catalogFingerprints, jobState } from "@/lib/db/schema";
import { getCatalogSnapshot } from "@/lib/erp";
import { tagsForEvents, type ChangeEvent } from "./events";
import { diffFingerprints, fingerprintKey, hashItem, type Fingerprints } from "./fingerprint";

/**
 * Scheduled catalog check (BUN-167): the fallback for missed webhooks.
 *
 * Every CHECK_INTERVAL_MS (run from the every-minute cron, POST /api/cron),
 * the ERP's whole catalog is read live and each item's fingerprint compared
 * with the last check. Exactly the changed products, categories, schemes or
 * banners are refreshed, so a price or visibility change is live within
 * about 5 minutes even if the ERP's webhook never arrived.
 *
 * The first run only records fingerprints (nothing to compare with yet).
 * If the ERP can't be read, nothing is changed and the next run tries again.
 */

export const CHECK_INTERVAL_MS = 5 * 60_000;
const STATE_KEY = "catalog_check";

type CheckState = { lastRunAt: string; changes: number };

export type CheckResult =
  | { status: "skipped"; nextRunAt: string }
  | { status: "baseline"; items: number }
  | { status: "checked"; items: number; events: ChangeEvent[]; revalidated: string[] };

async function readState(db: Db): Promise<CheckState | null> {
  const [row] = await db.select().from(jobState).where(eq(jobState.key, STATE_KEY)).limit(1);
  return (row?.value as CheckState | undefined) ?? null;
}

export async function checkCatalog(
  db: Db,
  options: { now?: Date; force?: boolean } = {},
): Promise<CheckResult> {
  const now = options.now ?? new Date();
  const state = await readState(db);
  if (state && !options.force) {
    const next = new Date(new Date(state.lastRunAt).getTime() + CHECK_INTERVAL_MS);
    if (next > now) return { status: "skipped", nextRunAt: next.toISOString() };
  }

  const snapshot = await getCatalogSnapshot();
  const current: Fingerprints = new Map();
  for (const p of snapshot.products) current.set(fingerprintKey("product", p.slug), hashItem(p));
  for (const c of snapshot.categories) current.set(fingerprintKey("category", c.slug), hashItem(c));
  for (const s of snapshot.schemes) current.set(fingerprintKey("scheme", s.link_id), hashItem(s));
  for (const b of snapshot.banners) current.set(fingerprintKey("banner", b.link_id), hashItem(b));

  const rows = await db.select().from(catalogFingerprints);
  const previous: Fingerprints = new Map(rows.map((r) => [`${r.kind}:${r.key}`, r.hash]));
  const events = rows.length === 0 ? [] : diffFingerprints(previous, current);

  const tags = tagsForEvents(events.length > 0 ? events : []);
  if (events.length > 0) {
    for (const tag of tags) revalidateTag(tag, "max");
    console.info(
      `[freshness] catalog check: ${events.length} change(s) → revalidated ${tags.join(", ")}`,
    );
  }

  // Store the new fingerprints (replace the whole set: it's a few hundred rows).
  await db.transaction(async (tx) => {
    await tx.delete(catalogFingerprints);
    const values = [...current].map(([key, hash]) => {
      const [kind, ...rest] = key.split(":");
      return { kind, key: rest.join(":"), hash, updatedAt: now };
    });
    for (let i = 0; i < values.length; i += 500) {
      await tx.insert(catalogFingerprints).values(values.slice(i, i + 500));
    }
    await tx
      .insert(jobState)
      .values({ key: STATE_KEY, value: { lastRunAt: now.toISOString(), changes: events.length } })
      .onConflictDoUpdate({
        target: jobState.key,
        set: {
          value: sql`excluded.value`,
          updatedAt: now,
        },
      });
  });

  return rows.length === 0
    ? { status: "baseline", items: current.size }
    : {
        status: "checked",
        items: current.size,
        events,
        revalidated: events.length > 0 ? tags : [],
      };
}
