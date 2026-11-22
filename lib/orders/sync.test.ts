import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

// The ERP is mocked; the database is a real (in-memory) Postgres via PGlite.
const getOrder = vi.fn();
vi.mock("@/lib/erp", () => ({ getOrder: (...a: unknown[]) => getOrder(...a) }));

const { applyStatus, pollOrderStatuses, refreshStatusIfStale } = await import("./sync");

let db: Db;
let orderId: string;

async function insertOrder(extra: Partial<schema.NewOrder> = {}) {
  const [row] = await db
    .insert(schema.orders)
    .values({
      number: `BT-261122-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      idempotencyKey: crypto.randomUUID(),
      customer: { name: "A", phone: "0771234567" },
      fulfilment: { type: "pickup", outletId: "o-1" },
      lines: [],
      payment: { method: "cash_on_delivery", status: "pending" },
      currency: "LKR",
      subtotal: 100,
      discountTotal: 0,
      deliveryFee: 0,
      total: 100,
      erpStatus: "submitted",
      erpOrderId: "erp-o-1",
      status: "pending",
      statusChangedAt: new Date("2026-11-22T10:00:00Z"),
      statusCheckedAt: new Date("2026-11-22T10:00:00Z"),
      ...extra,
    })
    .returning();
  return row;
}

const load = async (id = orderId) =>
  (await db.select().from(schema.orders).where(eq(schema.orders.id, id)))[0];

beforeEach(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: join(process.cwd(), "drizzle") });
  db = d as unknown as Db;
  orderId = (await insertOrder()).id;
  getOrder.mockReset();
});

describe("applyStatus", () => {
  it("applies a newer status and records it in the order history", async () => {
    const order = await load();
    const changed = await applyStatus(db, order, {
      status: "preparing",
      changedAt: new Date("2026-11-22T10:05:00Z"),
      source: "webhook",
    });
    expect(changed).toBe(true);
    expect((await load()).status).toBe("preparing");
    const events = await db.select().from(schema.orderEvents);
    expect(events.map((e) => e.message)).toEqual(["pending → preparing (webhook)"]);
  });

  it("ignores an older or repeated update (late or duplicate webhook)", async () => {
    await applyStatus(db, await load(), {
      status: "ready",
      changedAt: new Date("2026-11-22T10:10:00Z"),
      source: "webhook",
    });
    // A late webhook for an earlier change must not move the order back.
    const late = await applyStatus(db, await load(), {
      status: "preparing",
      changedAt: new Date("2026-11-22T10:05:00Z"),
      source: "webhook",
    });
    const duplicate = await applyStatus(db, await load(), {
      status: "ready",
      changedAt: new Date("2026-11-22T10:10:00Z"),
      source: "webhook",
    });
    expect([late, duplicate]).toEqual([false, false]);
    expect((await load()).status).toBe("ready");
  });
});

describe("polling fallback", () => {
  it("reads open orders not checked for 5 minutes, and skips finished ones", async () => {
    await insertOrder({ erpOrderId: "erp-o-done", status: "completed" });
    getOrder.mockResolvedValue({
      id: "erp-o-1",
      status: "dispatched",
      statusChangedAt: "2026-11-22T10:20:00Z",
    });

    // 3 minutes after the last check: not due.
    expect(await pollOrderStatuses(db, { now: new Date("2026-11-22T10:03:00Z") })).toMatchObject({
      checked: 0,
    });
    // 6 minutes after: due, only the open order is read.
    expect(await pollOrderStatuses(db, { now: new Date("2026-11-22T10:06:00Z") })).toEqual({
      checked: 1,
      changed: 1,
      errors: 0,
    });
    expect(getOrder).toHaveBeenCalledWith("erp-o-1");
    expect((await load()).status).toBe("dispatched");
  });

  it("keeps going when the ERP fails for one order", async () => {
    getOrder.mockRejectedValue(new Error("ERP down"));
    expect(await pollOrderStatuses(db, { now: new Date("2026-11-22T11:00:00Z") })).toEqual({
      checked: 1,
      changed: 0,
      errors: 1,
    });
  });

  it("re-checks on page view only when the status is over a minute old, and never throws", async () => {
    getOrder.mockResolvedValue({ id: "erp-o-1", status: "confirmed" });
    const order = await load();
    await refreshStatusIfStale(db, order, new Date("2026-11-22T10:00:30Z"));
    expect(getOrder).not.toHaveBeenCalled();

    const fresh = await refreshStatusIfStale(db, order, new Date("2026-11-22T10:02:00Z"));
    expect(fresh.status).toBe("confirmed");

    getOrder.mockRejectedValue(new Error("ERP down"));
    const stillShown = await refreshStatusIfStale(db, fresh, new Date("2026-11-22T10:05:00Z"));
    expect(stillShown.status).toBe("confirmed");
  });
});

describe("findOrderForErp", () => {
  it("matches our order number first and ignores an update whose ERP id belongs to another order", async () => {
    const { findOrderForErp } = await import("./sync");
    const order = await load();
    expect((await findOrderForErp(db, { storefrontOrderNumber: order.number }))?.id).toBe(order.id);
    expect(
      await findOrderForErp(db, {
        storefrontOrderNumber: order.number,
        erpOrderId: "someone-else",
      }),
    ).toBeUndefined();
    expect((await findOrderForErp(db, { erpOrderId: "erp-o-1" }))?.id).toBe(order.id);
  });
});
