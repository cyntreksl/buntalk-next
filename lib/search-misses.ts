import "server-only";
import { desc, gte, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { searchMisses } from "@/lib/db/schema";
import { searchKey } from "@/lib/search";

/**
 * "No result" searches (BUN-172), for the team to review: products people
 * look for that we don't have, or names and spellings search doesn't know.
 *
 * Only the normalised words are kept (no customer, IP or session), with a
 * count and when they were first and last seen.
 */

/**
 * Adds one to a query's count. Queries shorter than 2 characters are ignored.
 * The same query again within a few seconds isn't counted: one visit can
 * render the results more than once (streaming), and a double-click or
 * refresh shouldn't count twice either.
 */
export async function recordSearchMiss(db: Db, query: string): Promise<void> {
  const key = searchKey(query);
  if (key.length < 2) return;
  await db
    .insert(searchMisses)
    .values({ query: key })
    .onConflictDoUpdate({
      target: searchMisses.query,
      set: {
        count: sql`case when ${searchMisses.lastSeenAt} < now() - interval '3 seconds' then ${searchMisses.count} + 1 else ${searchMisses.count} end`,
        lastSeenAt: sql`now()`,
      },
    });
}

/** The most-searched "no result" queries seen in the last `days` days. */
export async function listSearchMisses(
  db: Db,
  { days = 30, limit = 100 }: { days?: number; limit?: number } = {},
) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(searchMisses)
    .where(gte(searchMisses.lastSeenAt, since))
    .orderBy(desc(searchMisses.count), desc(searchMisses.lastSeenAt))
    .limit(limit);
}
