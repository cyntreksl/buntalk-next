"use client";

import { useEffect } from "react";
import { unionCarts } from "@/lib/cart/merge";
import { useCartStore, type CartItem } from "./store";

const SAVE_DELAY_MS = 400;

const sameLines = (a: CartItem[], b: CartItem[]) =>
  a.length === b.length && a.every((x, i) => x.key === b[i].key && x.quantity === b[i].quantity);

/** Lines as the server saves them (it works out the key itself). */
const toSaved = (items: CartItem[]) =>
  items.map(
    ({ productSlug, skuId, name, variant, customization, imageUrl, unitPrice, quantity }) => ({
      productSlug,
      skuId,
      name,
      variant,
      customization,
      imageUrl,
      unitPrice,
      quantity,
    }),
  );

type SavedCart = { items: CartItem[]; updatedAt: string | null };

async function saveToServer(): Promise<void> {
  const { items, serverUpdatedAt } = useCartStore.getState();
  try {
    const res = await fetch("/api/cart", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // The saved version this browser started from, so a newer one is never overwritten.
      body: JSON.stringify({ items: toSaved(items), baseUpdatedAt: serverUpdatedAt ?? null }),
    });
    const body: SavedCart = await res.json().catch(() => null);
    if (!body) return;
    const store = useCartStore.getState();

    if (res.status === 409) {
      // The saved cart changed since (guest cart merged at sign-in, another device or
      // tab): keep it and add the lines only this browser has, then save that (BUN-178).
      const merged = unionCarts(body.items, store.items);
      if (sameLines(merged, body.items)) store.applyServer(body.items, body.updatedAt);
      else store.rebase(merged, body.updatedAt); // marked as changed: saved again shortly
      return;
    }
    if (!res.ok) return;
    // Take the server's cleaned copy, unless the cart changed again meanwhile
    // (that change is saved next, against this new version).
    if (store.items === items) store.applyServer(body.items, body.updatedAt);
    else store.setServerUpdatedAt(body.updatedAt);
  } catch {
    // Offline: the change stays marked and is sent on the next change or visit.
  }
}

async function loadFromServer() {
  const state = useCartStore.getState();
  // Changes the server doesn't have yet (made offline, or before saving existed) are
  // saved; if the saved cart changed meanwhile, the two are combined (see saveToServer).
  if (state.dirty) return saveToServer();
  try {
    const res = await fetch("/api/cart", { cache: "no-store" });
    if (!res.ok) return;
    const body: SavedCart = await res.json();
    // Nothing saved for this browser yet (new visitor, or cookies cleared): save what we have.
    if (body.updatedAt === null) {
      if (state.items.length > 0) {
        state.setServerUpdatedAt(null);
        await saveToServer();
      }
      return;
    }
    // The saved cart (another tab or device, the cart after sign-in, or the browser's
    // copy was cleared): show it.
    const current = useCartStore.getState();
    if (!current.dirty) current.applyServer(body.items, body.updatedAt);
  } catch {
    // Offline: keep the browser's copy.
  }
}

/**
 * Loads the saved cart now. Call after sign-in (BUN-186), once the server has
 * merged the guest cart into the customer's cart (lib/cart/signin.server.ts).
 */
export const syncCartNow = () => loadFromServer();

/**
 * Keeps the browser cart and the saved server cart in step (BUN-175):
 * - on page load and when the tab comes back into view, the saved cart is
 *   loaded (it may have changed on another device once sign-in exists);
 * - every change is saved shortly after it's made, against the saved version
 *   this browser last saw; if the saved cart changed meanwhile (sign-in merge,
 *   another device), the two are combined instead of overwritten (BUN-178);
 * - other open tabs pick up the change straight away (storage event).
 * Rendered once, in the app providers. Renders nothing.
 */
export function CartSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => void loadFromServer();
    if (useCartStore.persist.hasHydrated()) start();
    const unhydrated = useCartStore.persist.onFinishHydration(start);

    const unsubscribe = useCartStore.subscribe((state, prev) => {
      if (state.items === prev.items || !state.dirty) return;
      clearTimeout(timer);
      timer = setTimeout(() => void saveToServer(), SAVE_DELAY_MS);
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadFromServer();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "buntalk-cart") void useCartStore.persist.rehydrate();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("storage", onStorage);
    return () => {
      clearTimeout(timer);
      unhydrated();
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
