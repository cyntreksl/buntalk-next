import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { ErpConflictError, ErpNotFoundError, ErpUnavailableError } from "@/lib/erp";
import { formatPhone, normalizePhone } from "./phone";

// The ERP is mocked; the database is a real (in-memory) Postgres via PGlite.
const matchOrCreateCustomer = vi.fn();
const updateCustomer = vi.fn();
vi.mock("@/lib/erp", async () => ({
  ...(await import("@/lib/erp/errors")),
  matchOrCreateCustomer: (...a: unknown[]) => matchOrCreateCustomer(...a),
  updateCustomer: (...a: unknown[]) => updateCustomer(...a),
}));
const alerts: { kind: string }[] = [];
vi.mock("@/lib/alerts", () => ({
  sendTeamAlert: async (a: { kind: string }) => void alerts.push(a),
}));

const service = await import("./service");
const { syncCustomer, retryCustomerSync } = await import("./sync");

let db: Db;
beforeEach(async () => {
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: join(process.cwd(), "drizzle") });
  db = d as unknown as Db;
  alerts.length = 0;
  matchOrCreateCustomer.mockReset().mockResolvedValue({ id: "erp-c-1" });
  updateCustomer.mockReset().mockImplementation(async (id: string) => ({ id }));
});

const load = async (id: string) =>
  (await db.select().from(schema.customers).where(eq(schema.customers.id, id)))[0];

describe("phone numbers", () => {
  it("stores every Sri Lankan format the same way", () => {
    for (const input of [
      "077 123 4567",
      "0771234567",
      "+94 77-123-4567",
      "0094771234567",
      "94771234567",
    ]) {
      expect(normalizePhone(input)).toBe("+94771234567");
    }
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("0071234567")).toBeNull();
    expect(formatPhone("+94771234567")).toBe("077 123 4567");
  });
});

describe("registration", () => {
  it("refuses a phone or email already registered, in any format", async () => {
    await service.registerCustomer(db, {
      name: "Nimal",
      phone: "0771234567",
      email: "Nimal@Example.com",
    });
    await expect(
      service.registerCustomer(db, { name: "N", phone: "+94 77 123 4567" }),
    ).rejects.toMatchObject({ code: "phone_taken", status: 409 });
    await expect(
      service.registerCustomer(db, { name: "N", phone: "0719999999", email: "nimal@example.com" }),
    ).rejects.toMatchObject({ code: "email_taken" });
  });
});

describe("ERP sync", () => {
  it("links an existing ERP customer (no duplicate) and sends profile and addresses", async () => {
    const c = await service.registerCustomer(db, { name: "Nimal", phone: "0771234567" });
    await service.saveAddress(db, c.id, { label: "Home", line1: "12 Galle Road", city: "Galle" });

    expect(await syncCustomer(db, c.id)).toBe("synced");
    expect(matchOrCreateCustomer).toHaveBeenCalledWith(
      { name: "Nimal", phone: "+94771234567", email: undefined },
      `customer:${c.id}:link`,
    );
    const [erpId, profile, key] = updateCustomer.mock.calls[0];
    expect(erpId).toBe("erp-c-1");
    expect(profile.addresses).toEqual([
      {
        label: "Home",
        line1: "12 Galle Road",
        line2: undefined,
        city: "Galle",
        notes: undefined,
        isDefault: true,
      },
    ]);
    expect(key).toBe(`customer:${c.id}:v2`);
    expect(await load(c.id)).toMatchObject({
      erpCustomerId: "erp-c-1",
      syncStatus: "synced",
      syncedVersion: 2,
      version: 2,
    });

    // Already linked: a profile change is pushed without linking again.
    await service.updateProfile(db, c.id, { name: "Nimal Perera" });
    expect(await syncCustomer(db, c.id)).toBe("synced");
    expect(matchOrCreateCustomer).toHaveBeenCalledTimes(1);
    expect(updateCustomer.mock.calls[1][1].name).toBe("Nimal Perera");
  });

  it("stays pending when the customer changes while a sync is running", async () => {
    const c = await service.registerCustomer(db, { name: "Kamala", phone: "0715550000" });
    updateCustomer.mockImplementationOnce(async (id: string) => {
      await service.updateProfile(db, c.id, { email: "kamala@example.com" });
      return { id };
    });
    await syncCustomer(db, c.id);
    expect(await load(c.id)).toMatchObject({ syncStatus: "pending", syncedVersion: 1, version: 2 });
    await retryCustomerSync(db);
    expect(await load(c.id)).toMatchObject({ syncStatus: "synced", syncedVersion: 2 });
  });

  it("never links two storefront accounts to one ERP customer: conflict and alert", async () => {
    const a = await service.registerCustomer(db, { name: "A", phone: "0771111111" });
    const b = await service.registerCustomer(db, { name: "B", phone: "0772222222" });
    await syncCustomer(db, a.id);
    // The ERP matches B (e.g. by email) to the same ERP customer.
    expect(await syncCustomer(db, b.id)).toBe("conflict");
    expect(await load(b.id)).toMatchObject({
      syncStatus: "conflict",
      erpCustomerId: null,
      nextSyncAt: null,
    });
    expect(alerts.map((x) => x.kind)).toEqual(["conflict"]);
  });

  it("stops with a conflict when the ERP refuses the details (409)", async () => {
    const c = await service.registerCustomer(db, { name: "C", phone: "0773333333" });
    updateCustomer.mockRejectedValue(
      new ErpConflictError("Email belongs to another customer", "/customers/x"),
    );
    expect(await syncCustomer(db, c.id)).toBe("conflict");
  });

  it("retries temporary failures, and links again when the ERP customer was merged away", async () => {
    const c = await service.registerCustomer(db, { name: "D", phone: "0774444444" });
    updateCustomer.mockRejectedValueOnce(new ErpUnavailableError("/customers/x", "HTTP 503", 503));
    const t0 = new Date("2026-11-22T10:00:00Z");
    expect(await syncCustomer(db, c.id, t0)).toBe("failed");
    expect((await load(c.id)).nextSyncAt?.toISOString()).toBe("2026-11-22T10:01:00.000Z");

    // Next attempt: the old ERP customer is gone (404) → link again by phone → the survivor.
    updateCustomer.mockRejectedValueOnce(new ErpNotFoundError("/customers/erp-c-1"));
    matchOrCreateCustomer.mockResolvedValueOnce({ id: "erp-c-survivor" });
    expect(await retryCustomerSync(db, { now: new Date("2026-11-22T10:01:00Z") })).toMatchObject({
      synced: 1,
    });
    expect(await load(c.id)).toMatchObject({
      erpCustomerId: "erp-c-survivor",
      syncStatus: "synced",
    });
  });
});

describe("addresses", () => {
  it("keeps exactly one default address", async () => {
    const c = await service.registerCustomer(db, { name: "E", phone: "0775555555" });
    const home = await service.saveAddress(db, c.id, { line1: "1 Home St", city: "Galle" });
    const work = await service.saveAddress(db, c.id, {
      line1: "2 Work St",
      city: "Colombo",
      isDefault: true,
    });
    let list = await service.listAddresses(db, c.id);
    expect(list.map((a) => [a.line1, a.isDefault])).toEqual([
      ["1 Home St", false],
      ["2 Work St", true],
    ]);
    await service.deleteAddress(db, c.id, work.id);
    list = await service.listAddresses(db, c.id);
    expect(list.map((a) => [a.id, a.isDefault])).toEqual([[home.id, true]]);
  });
});
