import "server-only";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { CART_COOKIE, readCartTokenHash } from "./cookie.server";
import { mergeGuestCart } from "./persist.server";

/**
 * Call right after a customer signs in (BUN-186), from a route handler or
 * server action: moves the visitor's guest cart into the customer's saved
 * cart (BUN-178) and removes the guest cart cookie. From then on the cart is
 * saved against the customer, so it follows them to other devices.
 *
 * The browser then loads the merged cart on its own: its next save is
 * refused as out of date, and it combines its lines with the saved cart
 * (see features/cart/CartSync.tsx).
 *
 * Never throws: a failed merge must not stop the sign-in. The guest cart
 * stays saved and the browser still has its own copy.
 */
export async function mergeCartOnSignIn(customerId: string) {
  try {
    const tokenHash = await readCartTokenHash();
    if (!tokenHash) return null;
    const result = await mergeGuestCart(await getDb(), { tokenHash, customerId });
    (await cookies()).delete(CART_COOKIE);
    return result;
  } catch (error) {
    console.error("[cart] Could not merge the guest cart at sign-in.", error);
    return null;
  }
}
