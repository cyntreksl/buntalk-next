import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ErpConflictError, ErpUnavailableError } from "@/lib/erp";
import type { PlaceOrderInput } from "./input";

// ERP and cart pricing are mocked; the database is a real (in-memory) Postgres via PGlite.
const createOrder = vi.fn();
const matchOrCreateCustomer = vi.fn();
vi.mock("@/lib/erp", async () => ({
  ...(await import("@/lib/erp/errors")),
  createOrder: (...a: unknown[]) => createOrder(...a),
  matchOrCreateCustomer: (...a: unknown[]) => matchOrCreateCustomer(...a),
}));
const priceCart = vi.fn();
vi.mock("@/lib/cart.server", () => ({
  priceCart: (...a: unknown[]) => priceCart(...a),
  removedMessages: { not_available: "gone", sold_out: "sold out", choose_variant: "choose" },
}));
const alerts: { kind: string }[] = [];
vi.mock("./alerts", () => ({ sendOrderAlert: async (a: { kind: string }) => void alerts.push(a) }));

const { placeOrder, OrderError } = await import("./place");
const { submitOrder, retryDueSubmissions, requeueOrder, MAX_ATTEMPTS } = await import("./submit");

async function testDb(): Promise<Db> {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: join(process.cwd(), "drizzle") });
  return db as unknown as Db;
}

const pricedCart = {
  items: [
    {
      key: "fish-bun",
      productSlug: "fish-bun",
      productId: "p-fish-bun",
      name: "Fish bun",
      unitPrice: 120,
      quantity: 3,
      lineSubtotal: 360,
      discount: 120,
      lineTotal: 240,
      schemes: [{ id: "s-multibuy", name: "Bun bonanza" }],
    },
  ],
  removed: [],
  appliedSchemes: [{ id: "s-multibuy", name: "Bun bonanza", discount: 120 }],
  freeItems: [],
  currency: "LKR",
  subtotal: 360,
  discountTotal: 120,
  total: 240,
};

const input = (key = crypto.randomUUID()): PlaceOrderInput => ({
  idempotencyKey: key,
  lines: [{ productSlug: "fish-bun", quantity: 3 }],
  customer: { name: "Nimal Perera", phone: "0771234567" },
  fulfilment: { type: "delivery", address: { line1: "12 Galle Road", city: "Galle" } },
  payment: { method: "cash_on_delivery" },
});

let db: Db;
beforeEach(async () => {
  db = await testDb();
  alerts.length = 0;
  priceCart.mockReset().mockResolvedValue(pricedCart);
  matchOrCreateCustomer.mockReset().mockResolvedValue({ id: "cust-1" });
  createOrder.mockReset().mockResolvedValue({ id: "erp-o-1", number: "WEB-1001" });
});

const load = async (id: string) =>
  (await db.select().from(schema.orders).where(eq(schema.orders.id, id)))[0];

describe("placeOrder", () => {
  it("saves a snapshot priced by the server, with an order number", async () => {
    const { order, created } = await placeOrder(db, input());
    expect(created).toBe(true);
    expect(order.number).toMatch(/^BT-\d{6}-[2-9A-HJKMNP-Z]{5}$/);
    expect([order.subtotal, order.discountTotal, order.total]).toEqual([360, 120, 240]);
    expect(order.lines[0]).toMatchObject({ productId: "p-fish-bun", schemeIds: ["s-multibuy"] });
    expect(order.erpStatus).toBe("pending");
  });

  it("returns the same order for the same idempotency key, even when sent at the same time", async () => {
    const key = crypto.randomUUID();
    const [a, b] = await Promise.all([placeOrder(db, input(key)), placeOrder(db, input(key))]);
    expect(a.order.id).toBe(b.order.id);
    expect(await db.select().from(schema.orders)).toHaveLength(1);
  });

  it("refuses the order when the cart changed (hidden or sold-out items)", async () => {
    priceCart.mockResolvedValue({ ...pricedCart, removed: [{ key: "x", reason: "sold_out" }] });
    await expect(placeOrder(db, input())).rejects.toBeInstanceOf(OrderError);
    expect(await db.select().from(schema.orders)).toHaveLength(0);
  });
});

describe("submitOrder", () => {
  it("sends the order once and stores the ERP order number", async () => {
    const { order } = await placeOrder(db, input());
    expect(await submitOrder(db, order.id)).toBe("submitted");

    const saved = await load(order.id);
    expect(saved).toMatchObject({
      erpStatus: "submitted",
      erpOrderNumber: "WEB-1001",
      erpCustomerId: "cust-1",
      attempts: 1,
      nextAttemptAt: null,
    });
    // The order's idempotency key goes to the ERP, so ERP-side retries can't duplicate.
    expect(createOrder.mock.calls[0][1]).toBe(order.idempotencyKey);
    expect(createOrder.mock.calls[0][0]).toMatchObject({
      storefrontOrderNumber: order.number,
      customerId: "cust-1",
      total: 240,
      lines: [{ productId: "p-fish-bun", quantity: 3, unitPrice: 120, discount: 120 }],
    });
    // Already submitted: a second run does nothing.
    expect(await submitOrder(db, order.id)).toBe("skipped");
    expect(createOrder).toHaveBeenCalledTimes(1);
  });

  it("keeps the order and retries later when the ERP is down, then succeeds", async () => {
    const { order } = await placeOrder(db, input());
    createOrder.mockRejectedValueOnce(new ErpUnavailableError("/orders", "HTTP 503", 503));
    const t0 = new Date("2026-11-22T10:00:00Z");

    expect(await submitOrder(db, order.id, t0)).toBe("failed");
    let saved = await load(order.id);
    expect(saved.erpStatus).toBe("failed");
    expect(saved.lastError).toContain("503");
    expect(saved.nextAttemptAt?.toISOString()).toBe("2026-11-22T10:01:00.000Z");

    // Not due yet → nothing happens.
    expect(await retryDueSubmissions(db, { now: new Date("2026-11-22T10:00:30Z") })).toMatchObject({
      submitted: 0,
    });
    // Due → sent.
    expect(await retryDueSubmissions(db, { now: new Date("2026-11-22T10:01:00Z") })).toMatchObject({
      submitted: 1,
    });
    saved = await load(order.id);
    expect(saved).toMatchObject({
      erpStatus: "submitted",
      attempts: 2,
      erpOrderNumber: "WEB-1001",
    });
    // The customer was matched once and reused on the retry.
    expect(matchOrCreateCustomer).toHaveBeenCalledTimes(1);
  });

  it("alerts after repeated failures and gives up after the maximum attempts", async () => {
    const { order } = await placeOrder(db, input());
    createOrder.mockRejectedValue(new ErpUnavailableError("/orders", "HTTP 503", 503));
    let now = new Date("2026-11-22T10:00:00Z");
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await submitOrder(db, order.id, now);
      now = new Date(now.getTime() + 2 * 60 * 60_000);
    }
    const saved = await load(order.id);
    expect(saved).toMatchObject({
      erpStatus: "failed",
      attempts: MAX_ATTEMPTS,
      nextAttemptAt: null,
    });
    expect(alerts.map((a) => a.kind)).toEqual(["failing", "gave_up"]);
    // Gave up: the queue leaves it alone until the team requeues it.
    expect(await retryDueSubmissions(db, { now })).toMatchObject({ submitted: 0, failed: 0 });

    createOrder.mockResolvedValue({ id: "erp-o-1", number: "WEB-1001" });
    await requeueOrder(db, order.number, now);
    expect(await retryDueSubmissions(db, { now })).toMatchObject({ submitted: 1 });
  });

  it("marks the order rejected and alerts at once when the ERP refuses it", async () => {
    const { order } = await placeOrder(db, input());
    createOrder.mockRejectedValue(new ErpConflictError("Prices changed", "/orders"));
    expect(await submitOrder(db, order.id)).toBe("rejected");
    expect(await load(order.id)).toMatchObject({ erpStatus: "rejected", nextAttemptAt: null });
    expect(alerts.map((a) => a.kind)).toEqual(["rejected"]);
  });

  it("never sends the same order twice when two workers run at once", async () => {
    const { order } = await placeOrder(db, input());
    const results = await Promise.all([submitOrder(db, order.id), submitOrder(db, order.id)]);
    expect(results.sort()).toEqual(["skipped", "submitted"]);
    expect(createOrder).toHaveBeenCalledTimes(1);
  });
});
