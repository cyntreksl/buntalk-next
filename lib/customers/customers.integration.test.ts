import { join } from "node:path";
import type { Server } from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

/**
 * End to end with the real ERP client (lib/erp) against the mock ERP
 * (scripts/mock-erp.mjs, started in-process on its own port), and a real
 * Postgres (PGlite). Nothing mocked in between.
 */
const PORT = 4031;
vi.stubEnv("MOCK_ERP_PORT", String(PORT));
vi.stubEnv("ERP_API_BASE_URL", `http://127.0.0.1:${PORT}/api`);
vi.stubEnv("ERP_API_KEY", "mock-key");
vi.stubEnv("ERP_TENANT", "buntalk");

const ERP = `http://127.0.0.1:${PORT}`;
const erpCustomers = async () =>
  (await (await fetch(`${ERP}/__mock/customers`)).json()).data as {
    link_id: string;
    name: string;
    phone: string;
    email: string | null;
    addresses: { line1: string; city: string; is_default: boolean }[];
  }[];

let server: Server;
let db: Db;
let customers: typeof import("./index");

beforeAll(async () => {
  ({ server } = await import("../../scripts/mock-erp.mjs"));
  await new Promise((r) => (server.listening ? r(null) : server.once("listening", r)));
  customers = await import("./index");
  const d = drizzle(new PGlite(), { schema });
  await migrate(d, { migrationsFolder: join(process.cwd(), "drizzle") });
  db = d as unknown as Db;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

const load = async (id: string) =>
  (await db.select().from(schema.customers).where(eq(schema.customers.id, id)))[0];

describe("customer sync with the (mock) ERP", () => {
  it("links an existing ERP customer who signs up online instead of creating a duplicate", async () => {
    const before = (await erpCustomers()).length;
    // A walk-in shop customer (already in the ERP) registers online with a differently formatted number.
    const c = await customers.registerCustomer(db, { name: "Sunil F.", phone: "077 000 0099" });
    await customers.saveAddress(db, c.id, {
      label: "Home",
      line1: "5 Temple Road",
      city: "Matara",
    });

    expect(await customers.syncCustomer(db, c.id)).toBe("synced");
    const erp = await erpCustomers();
    expect(erp).toHaveLength(before);
    expect((await load(c.id)).erpCustomerId).toBe("cust-walkin");
    const walkin = erp.find((x) => x.link_id === "cust-walkin")!;
    expect(walkin.name).toBe("Sunil F.");
    expect(walkin.addresses).toEqual([
      expect.objectContaining({ line1: "5 Temple Road", city: "Matara", is_default: true }),
    ]);
  });

  it("creates a new ERP customer for a new person, and profile changes appear in the ERP", async () => {
    const c = await customers.registerCustomer(db, {
      name: "Nimal Perera",
      phone: "0771234567",
      email: "nimal@example.com",
    });
    await customers.syncCustomer(db, c.id);
    const linked = await load(c.id);
    expect(linked.erpCustomerId).toMatch(/^cust-\d+$/);

    await customers.updateProfile(db, c.id, {
      name: "Nimal K. Perera",
      email: "nimal.k@example.com",
    });
    await customers.syncCustomer(db, c.id);
    const erp = (await erpCustomers()).find((x) => x.link_id === linked.erpCustomerId)!;
    expect(erp).toMatchObject({
      name: "Nimal K. Perera",
      email: "nimal.k@example.com",
      phone: "+94771234567",
    });
    expect(await load(c.id)).toMatchObject({ syncStatus: "synced", syncedVersion: 2 });
  });

  it("refuses an email another storefront account already uses, before the ERP is asked", async () => {
    const c = await customers.registerCustomer(db, { name: "Ruwan", phone: "0716660000" });
    await expect(
      customers.updateProfile(db, c.id, { email: "NIMAL.K@example.com" }),
    ).rejects.toMatchObject({ code: "email_taken" });
  });

  it("stops with a conflict when the new email belongs to another customer in the ERP only", async () => {
    // A shop customer known only to the ERP.
    await fetch(`${ERP}/api/v1/tenants/buntalk/storefront/customers`, {
      method: "POST",
      headers: {
        Authorization: "Bearer mock-key",
        "Content-Type": "application/json",
        "Idempotency-Key": "seed-erp-only",
      },
      body: JSON.stringify({
        name: "Shop Only",
        phone: "+94779990000",
        email: "shop.only@example.com",
      }),
    });
    const c = await customers.registerCustomer(db, { name: "Kamala", phone: "0715550000" });
    await customers.syncCustomer(db, c.id);
    await customers.updateProfile(db, c.id, { email: "shop.only@example.com" });
    expect(await customers.syncCustomer(db, c.id)).toBe("conflict");
    expect((await load(c.id)).lastSyncError).toContain("409");
  });
});
