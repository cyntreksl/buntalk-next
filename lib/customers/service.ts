import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { customerAddresses, customers, type Customer, type CustomerAddress } from "@/lib/db/schema";
import { normalizeEmail, normalizePhone } from "./phone";

/**
 * Storefront customer records (BUN-166). The storefront keeps one row per
 * customer, linked to exactly one ERP customer; every change bumps the
 * customer's version and is sent to the ERP by lib/customers/sync.ts.
 *
 * Used by registration (BUN-187/192), the profile page (BUN-193) and saved
 * addresses (BUN-198), always behind sign-in. There is deliberately no public
 * API for these until sign-in exists (BUN-186).
 */

export class CustomerError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "CustomerError";
  }
}

/** Postgres unique violation (23505), optionally for one constraint. */
function isUniqueViolation(error: unknown, constraint?: string): boolean {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const err = e as { code?: string; constraint?: string; message?: string };
    if (err.code === "23505") {
      return !constraint || err.constraint === constraint || !!err.message?.includes(constraint);
    }
  }
  return false;
}

function duplicateError(error: unknown): never {
  if (isUniqueViolation(error, "customers_phone_unique")) {
    throw new CustomerError(
      "An account with this phone number already exists.",
      409,
      "phone_taken",
    );
  }
  if (isUniqueViolation(error, "customers_email_unique")) {
    throw new CustomerError(
      "An account with this email address already exists.",
      409,
      "email_taken",
    );
  }
  throw error;
}

function cleanPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    throw new CustomerError("Enter a valid phone number, e.g. 077 123 4567", 400, "invalid_phone");
  }
  return normalized;
}

/** Marks the customer as changed: the sync worker sends the new version to the ERP. */
async function markChanged(db: Db, customerId: string, now = new Date()) {
  await db
    .update(customers)
    .set({
      version: sql`${customers.version} + 1`,
      syncStatus: "pending",
      nextSyncAt: now,
      syncAttempts: 0,
      updatedAt: now,
    })
    .where(eq(customers.id, customerId));
}

export async function findCustomerByPhone(db: Db, phone: string): Promise<Customer | undefined> {
  const normalized = normalizePhone(phone);
  if (!normalized) return undefined;
  const [row] = await db.select().from(customers).where(eq(customers.phone, normalized)).limit(1);
  return row;
}

export async function getCustomer(db: Db, id: string): Promise<Customer | undefined> {
  const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return row;
}

/**
 * Creates the storefront customer at registration. The ERP link is made by
 * the sync worker (an existing ERP customer with this phone or email is
 * linked, never duplicated). A phone or email already registered on the
 * storefront is refused with 409.
 */
export async function registerCustomer(
  db: Db,
  input: { name: string; phone: string; email?: string },
): Promise<Customer> {
  const name = input.name.trim();
  if (!name) throw new CustomerError("Enter your name.", 400, "invalid_name");
  try {
    const [customer] = await db
      .insert(customers)
      .values({
        name,
        phone: cleanPhone(input.phone),
        email: input.email ? normalizeEmail(input.email) : null,
      })
      .returning();
    return customer;
  } catch (error) {
    duplicateError(error);
  }
}

/** Profile changes from the account page. Sent to the ERP by the sync worker. */
export async function updateProfile(
  db: Db,
  customerId: string,
  patch: { name?: string; phone?: string; email?: string | null },
): Promise<Customer> {
  const values: Partial<typeof customers.$inferInsert> = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new CustomerError("Enter your name.", 400, "invalid_name");
    values.name = patch.name.trim();
  }
  if (patch.phone !== undefined) values.phone = cleanPhone(patch.phone);
  if (patch.email !== undefined) values.email = patch.email ? normalizeEmail(patch.email) : null;

  try {
    const [updated] = await db
      .update(customers)
      .set(values)
      .where(eq(customers.id, customerId))
      .returning({ id: customers.id });
    if (!updated) throw new CustomerError("Customer not found.", 404, "not_found");
  } catch (error) {
    if (error instanceof CustomerError) throw error;
    duplicateError(error);
  }
  await markChanged(db, customerId);
  return (await getCustomer(db, customerId))!;
}

export type AddressInput = {
  label?: string;
  line1: string;
  line2?: string;
  city: string;
  notes?: string;
  isDefault?: boolean;
};

export async function listAddresses(db: Db, customerId: string): Promise<CustomerAddress[]> {
  return db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customerId))
    .orderBy(asc(customerAddresses.createdAt));
}

/** Adds or edits a saved address. The first address, or one marked default, becomes the default. */
export async function saveAddress(
  db: Db,
  customerId: string,
  input: AddressInput,
  addressId?: string,
): Promise<CustomerAddress> {
  if (!input.line1.trim() || !input.city.trim()) {
    throw new CustomerError("Enter the street address and city.", 400, "invalid_address");
  }
  const existing = await listAddresses(db, customerId);
  const isDefault = input.isDefault || existing.length === 0;
  if (isDefault) {
    await db
      .update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.customerId, customerId));
  }
  const values = {
    label: input.label?.trim() || null,
    line1: input.line1.trim(),
    line2: input.line2?.trim() || null,
    city: input.city.trim(),
    notes: input.notes?.trim() || null,
    isDefault,
    updatedAt: new Date(),
  };

  let address: CustomerAddress | undefined;
  if (addressId) {
    [address] = await db
      .update(customerAddresses)
      .set(values)
      .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, customerId)))
      .returning();
    if (!address) throw new CustomerError("Address not found.", 404, "not_found");
  } else {
    [address] = await db
      .insert(customerAddresses)
      .values({ ...values, customerId })
      .returning();
  }
  await markChanged(db, customerId);
  return address;
}

export async function deleteAddress(db: Db, customerId: string, addressId: string): Promise<void> {
  const [deleted] = await db
    .delete(customerAddresses)
    .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, customerId)))
    .returning();
  if (!deleted) throw new CustomerError("Address not found.", 404, "not_found");
  if (deleted.isDefault) {
    // Keep one default: the oldest remaining address.
    const [next] = await listAddresses(db, customerId);
    if (next) {
      await db
        .update(customerAddresses)
        .set({ isDefault: true })
        .where(eq(customerAddresses.id, next.id));
    }
  }
  await markChanged(db, customerId);
}
