import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { customizationSchema, lineKey } from "@/lib/cart.server";
import type { Db } from "@/lib/db";
import { carts, type SavedCartLine } from "@/lib/db/schema";
import { MAX_CART_LINES, MAX_QUANTITY } from "./limits";
import { mergeCarts } from "./merge";

/**
 * Saved carts (BUN-175). The browser keeps a copy for speed; the server copy
 * makes the cart survive a cleared browser and, once sign-in exists
 * (BUN-186), follow the customer across devices.
 *
 * Saving is cheap (no ERP call). Every line still goes through the ERP check
 * when it's added (POST /api/cart/items) and when the cart or checkout opens
 * (POST /api/cart/validate), which drops hidden or sold-out items.
 */

/** A guest cart is kept this long after its last change. */
export const GUEST_CART_DAYS = 60;

export const savedLineSchema = z.object({
  productSlug: z.string().trim().min(1).max(200),
  skuId: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(200),
  variant: z.string().trim().max(100).optional(),
  customization: customizationSchema.optional(),
  /** Display copy of the product photo. */
  imageUrl: z
    .url({ protocol: /^https?$/ })
    .max(500)
    .optional(),
  unitPrice: z.number().nonnegative().max(10_000_000),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
});

/** Who the cart belongs to: a signed-in customer, or a guest's cookie token (hashed). */
export type CartOwner = { customerId?: string | null; tokenHash?: string | null };

export const newCartToken = () => randomBytes(32).toString("base64url");
export const hashCartToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Cleans lines before saving: one line per product, size and design (the
 * key is worked out here, never trusted from the browser), quantities added
 * up and kept within 1–99, at most 50 lines.
 */
export function normalizeLines(lines: z.input<typeof savedLineSchema>[]): SavedCartLine[] {
  const byKey = new Map<string, SavedCartLine>();
  for (const raw of lines) {
    const line = savedLineSchema.parse(raw);
    const key = lineKey(line.productSlug, line.skuId, line.customization?.designId);
    const existing = byKey.get(key);
    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + line.quantity);
    } else {
      byKey.set(key, { ...line, key });
    }
  }
  return [...byKey.values()].slice(0, MAX_CART_LINES);
}

const where = (owner: CartOwner) =>
  owner.customerId
    ? eq(carts.customerId, owner.customerId)
    : owner.tokenHash
      ? eq(carts.tokenHash, owner.tokenHash)
      : undefined;

export async function loadCart(
  db: Db,
  owner: CartOwner,
): Promise<{ lines: SavedCartLine[]; updatedAt: Date } | null> {
  const condition = where(owner);
  if (!condition) return null;
  const [row] = await db.select().from(carts).where(condition).limit(1);
  return row ? { lines: row.lines, updatedAt: row.updatedAt } : null;
}

type Saved = { lines: SavedCartLine[]; updatedAt: Date };

/**
 * Replaces the saved cart's lines (creating the cart if needed).
 *
 * With `baseUpdatedAt` (the saved cart's time when this browser last loaded
 * or saved it; null if it never did), the save is refused when the saved
 * cart has changed since, for example the guest cart was merged in at
 * sign-in or another device changed it. The caller then gets the current
 * saved cart (`conflict`) and combines it with its own lines (BUN-178).
 */
export async function saveCart(
  db: Db,
  owner: CartOwner,
  lines: SavedCartLine[],
  options: { baseUpdatedAt?: Date | null } = {},
): Promise<Saved & { conflict?: boolean }> {
  const target = owner.customerId
    ? { column: carts.customerId, values: { customerId: owner.customerId } }
    : owner.tokenHash
      ? { column: carts.tokenHash, values: { tokenHash: owner.tokenHash } }
      : null;
  if (!target) throw new Error("A cart needs a customer or a cart token.");

  return db.transaction(async (tx) => {
    if (options.baseUpdatedAt !== undefined) {
      const [current] = await tx.select().from(carts).where(where(owner)!).for("update").limit(1);
      const base = options.baseUpdatedAt?.getTime() ?? -Infinity;
      if (current && current.updatedAt.getTime() > base) {
        return { lines: current.lines, updatedAt: current.updatedAt, conflict: true };
      }
    }
    // Millisecond time, so the browser's copy of it compares exactly.
    const now = new Date();
    const [row] = await tx
      .insert(carts)
      .values({ ...target.values, lines, updatedAt: now })
      .onConflictDoUpdate({ target: target.column, set: { lines, updatedAt: now } })
      .returning();
    return { lines: row.lines, updatedAt: row.updatedAt };
  });
}

/**
 * Sign-in (BUN-178): moves the guest cart (found by its cookie token) into
 * the customer's saved cart and deletes the guest cart, in one transaction.
 * Same product, size and design: quantities added up (at most 99). Safe to
 * call more than once: with no guest cart left, it returns the customer's
 * cart unchanged.
 */
export async function mergeGuestCart(
  db: Db,
  { tokenHash, customerId }: { tokenHash: string; customerId: string },
): Promise<Saved & { merged: number; dropped: number }> {
  return db.transaction(async (tx) => {
    const [guest] = await tx
      .select()
      .from(carts)
      .where(eq(carts.tokenHash, tokenHash))
      .for("update")
      .limit(1);
    const [saved] = await tx
      .select()
      .from(carts)
      .where(eq(carts.customerId, customerId))
      .for("update")
      .limit(1);
    if (guest) await tx.delete(carts).where(eq(carts.id, guest.id));
    const guestLines = guest?.lines ?? [];
    if (guestLines.length === 0) {
      return {
        lines: saved?.lines ?? [],
        updatedAt: saved?.updatedAt ?? new Date(0),
        merged: 0,
        dropped: 0,
      };
    }
    const { lines, dropped } = mergeCarts(saved?.lines ?? [], guestLines);
    const now = new Date();
    const [row] = await tx
      .insert(carts)
      .values({ customerId, lines, updatedAt: now })
      .onConflictDoUpdate({ target: carts.customerId, set: { lines, updatedAt: now } })
      .returning();
    return { lines: row.lines, updatedAt: row.updatedAt, merged: guestLines.length, dropped };
  });
}

/** Deletes guest carts not changed for GUEST_CART_DAYS days (run by the scheduled job). */
export async function deleteStaleGuestCarts(db: Db, now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - GUEST_CART_DAYS * 24 * 60 * 60 * 1000);
  const deleted = await db
    .delete(carts)
    .where(and(isNull(carts.customerId), lt(carts.updatedAt, before)))
    .returning({ id: carts.id });
  return deleted.length;
}
