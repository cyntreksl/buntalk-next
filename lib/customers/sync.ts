import "server-only";
import { and, asc, eq, inArray, isNotNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { sendTeamAlert } from "@/lib/alerts";
import type { Db } from "@/lib/db";
import { customerAddresses, customers, type Customer } from "@/lib/db/schema";
import {
  ErpConflictError,
  ErpError,
  ErpNotFoundError,
  ErpValidationError,
  matchOrCreateCustomer,
  updateCustomer,
} from "@/lib/erp";

/**
 * Keeps each storefront customer linked to exactly one ERP customer and the
 * ERP's copy of the profile and addresses up to date (BUN-166).
 *
 * 1. Link: the first sync calls POST /customers (match by phone, then email,
 *    or create, tagged as a storefront customer). An existing ERP customer who
 *    signs up online is linked, not duplicated. Each ERP customer can be
 *    linked to one storefront customer only (unique erp_customer_id).
 * 2. Push: PUT /customers/{id} with the full profile and addresses. Every
 *    local change bumps `version`; the worker sends the version it read and
 *    records it as synced, so a change made during a sync is sent next time.
 *
 * Same safety as orders: one worker per customer (atomic claim), idempotency
 * keys on every write, retries with growing waits (1, 2, 4 … minutes, ≤ 1 h,
 * up to 8 attempts), and alerts. A conflict (phone/email belonging to another
 * ERP customer, or two storefront accounts for one ERP customer) stops and
 * alerts the team, so nothing is merged by guesswork.
 */

export const MAX_SYNC_ATTEMPTS = 8;
const STALE_LOCK_MS = 5 * 60_000;
const ALERT_AFTER_ATTEMPTS = 3;

const retryDelayMs = (attempts: number) =>
  Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 60 * 60_000);

const describe = (error: unknown) =>
  error instanceof ErpError
    ? `${error.name} (${error.status}) ${error.message}${error.requestId ? ` [request ${error.requestId}]` : ""}`
    : error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);

class LinkConflict extends Error {}

async function claim(db: Db, id: string, now: Date): Promise<Customer | null> {
  const [claimed] = await db
    .update(customers)
    .set({
      syncStatus: "syncing",
      lockedAt: now,
      syncAttempts: sql`${customers.syncAttempts} + 1`,
    })
    .where(
      and(
        eq(customers.id, id),
        or(
          inArray(customers.syncStatus, ["pending", "failed"]),
          and(
            eq(customers.syncStatus, "syncing"),
            lt(customers.lockedAt, new Date(now.getTime() - STALE_LOCK_MS)),
          ),
        ),
      ),
    )
    .returning();
  return claimed ?? null;
}

/** Links the customer to an ERP customer (match or create). Returns the ERP id. */
async function link(db: Db, customer: Customer): Promise<string> {
  const erp = await matchOrCreateCustomer(
    { name: customer.name, phone: customer.phone, email: customer.email ?? undefined },
    `customer:${customer.id}:link`,
  );
  const erpId = erp.mergedIntoId ?? erp.id;

  // One ERP customer ↔ one storefront customer.
  const [other] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.erpCustomerId, erpId), ne(customers.id, customer.id)))
    .limit(1);
  if (other) {
    throw new LinkConflict(
      `ERP customer ${erpId} (matched by phone/email) is already linked to storefront customer ${other.id}`,
    );
  }
  await db.update(customers).set({ erpCustomerId: erpId }).where(eq(customers.id, customer.id));
  return erpId;
}

export type CustomerSyncResult = "synced" | "failed" | "conflict" | "skipped";

export async function syncCustomer(
  db: Db,
  customerId: string,
  now: Date = new Date(),
): Promise<CustomerSyncResult> {
  const customer = await claim(db, customerId, now);
  if (!customer) return "skipped";

  try {
    let erpId = customer.erpCustomerId ?? (await link(db, customer));
    const addresses = await db
      .select()
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, customer.id))
      .orderBy(asc(customerAddresses.createdAt));

    const profile = {
      name: customer.name,
      phone: customer.phone,
      email: customer.email ?? undefined,
      addresses: addresses.map((a) => ({
        label: a.label ?? undefined,
        line1: a.line1,
        line2: a.line2 ?? undefined,
        city: a.city,
        notes: a.notes ?? undefined,
        isDefault: a.isDefault,
      })),
    };

    let updated;
    try {
      updated = await updateCustomer(
        erpId,
        profile,
        `customer:${customer.id}:v${customer.version}`,
      );
    } catch (error) {
      // The ERP customer is gone (e.g. merged or deleted): link again by phone and retry once.
      if (!(error instanceof ErpNotFoundError)) throw error;
      await db.update(customers).set({ erpCustomerId: null }).where(eq(customers.id, customer.id));
      erpId = await link(db, { ...customer, erpCustomerId: null });
      updated = await updateCustomer(
        erpId,
        profile,
        `customer:${customer.id}:v${customer.version}`,
      );
    }
    if (updated.mergedIntoId) erpId = updated.mergedIntoId;

    // Synced up to the version we read. If the customer changed meanwhile, stay pending.
    await db
      .update(customers)
      .set({
        erpCustomerId: erpId,
        syncedVersion: customer.version,
        syncStatus: sql`case when ${customers.version} > ${customer.version} then 'pending'::customer_sync_status else 'synced'::customer_sync_status end`,
        nextSyncAt: sql`case when ${customers.version} > ${customer.version} then now() else null end`,
        syncAttempts: 0,
        lastSyncError: null,
        lockedAt: null,
        syncedAt: now,
      })
      .where(eq(customers.id, customer.id));
    console.info(`[customers] ${customer.id} synced to ERP ${erpId} (v${customer.version})`);
    return "synced";
  } catch (error) {
    const detail = describe(error);
    const conflict =
      error instanceof LinkConflict ||
      error instanceof ErpConflictError ||
      error instanceof ErpValidationError ||
      // Two storefront rows racing for the same ERP id.
      (error instanceof Error &&
        /customers_erp_customer_id_unique/.test(`${error.message} ${String(error.cause)}`));

    if (conflict) {
      await db
        .update(customers)
        .set({ syncStatus: "conflict", nextSyncAt: null, lockedAt: null, lastSyncError: detail })
        .where(eq(customers.id, customer.id));
      await sendTeamAlert({
        area: "customers",
        kind: "conflict",
        subject: `Customer ${customer.id} (${customer.phone})`,
        message:
          "Can't link this storefront customer to the ERP without a duplicate. Check the ERP customer and merge or correct the details.",
        detail,
      });
      return "conflict";
    }

    const gaveUp = customer.syncAttempts >= MAX_SYNC_ATTEMPTS;
    await db
      .update(customers)
      .set({
        syncStatus: "failed",
        lockedAt: null,
        lastSyncError: detail,
        nextSyncAt: gaveUp ? null : new Date(now.getTime() + retryDelayMs(customer.syncAttempts)),
      })
      .where(eq(customers.id, customer.id));
    console.warn(
      `[customers] ${customer.id} sync failed (attempt ${customer.syncAttempts}): ${detail}`,
    );
    if (gaveUp || customer.syncAttempts === ALERT_AFTER_ATTEMPTS) {
      await sendTeamAlert({
        area: "customers",
        kind: gaveUp ? "gave_up" : "failing",
        subject: `Customer ${customer.id} (${customer.phone})`,
        message: gaveUp
          ? `Gave up sending this customer to the ERP after ${customer.syncAttempts} attempts.`
          : `Still can't send this customer to the ERP after ${customer.syncAttempts} attempts. Retrying automatically.`,
        detail,
      });
    }
    return "failed";
  }
}

/** Runs the customer sync queue (called by the every-minute cron, POST /api/orders/retry). */
export async function retryCustomerSync(
  db: Db,
  options: { limit?: number; now?: Date } = {},
): Promise<Record<CustomerSyncResult, number>> {
  const now = options.now ?? new Date();
  const due = await db
    .select({ id: customers.id })
    .from(customers)
    .where(
      or(
        and(
          inArray(customers.syncStatus, ["pending", "failed"]),
          isNotNull(customers.nextSyncAt),
          lte(customers.nextSyncAt, now),
        ),
        and(
          eq(customers.syncStatus, "syncing"),
          lt(customers.lockedAt, new Date(now.getTime() - STALE_LOCK_MS)),
        ),
      ),
    )
    .orderBy(asc(customers.nextSyncAt))
    .limit(options.limit ?? 25);

  const summary: Record<CustomerSyncResult, number> = {
    synced: 0,
    failed: 0,
    conflict: 0,
    skipped: 0,
  };
  for (const { id } of due) summary[await syncCustomer(db, id, now)]++;
  return summary;
}

/** Customers the team should look at: conflicts, failures, or not linked after 10 minutes. */
export async function listCustomerSyncProblems(db: Db, now: Date = new Date()) {
  return db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      syncStatus: customers.syncStatus,
      syncAttempts: customers.syncAttempts,
      lastSyncError: customers.lastSyncError,
      erpCustomerId: customers.erpCustomerId,
      updatedAt: customers.updatedAt,
    })
    .from(customers)
    .where(
      or(
        inArray(customers.syncStatus, ["failed", "conflict"]),
        and(
          eq(customers.syncStatus, "pending"),
          lt(customers.updatedAt, new Date(now.getTime() - 10 * 60_000)),
        ),
      ),
    )
    .limit(100);
}
