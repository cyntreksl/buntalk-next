"use client";

import { useEffect } from "react";
import { useCartStore, type CartItem } from "./store";

const SAVE_DELAY_MS = 400;

const sameLines = (a: CartItem[], b: CartItem[]) =>
  a.length === b.length && a.every((x, i) => x.key === b[i].key && x.quantity === b[i].quantity);

/** Lines as the server saves them (it works out the key itself). */
const toSaved = (items: CartItem[]) =>
  items.map(({ productSlug, skuId, name, variant, customization, unitPrice, quantity }) => ({
    productSlug,
    skuId,
    name,
    variant,
    customization,
    unitPrice,
    quantity,
  }));

async function saveToServer() {
  const { items } = useCartStore.getState();
  try {
    const res = await fetch("/api/cart", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: toSaved(items) }),
    });
    if (!res.ok) return;
    const body: { items: CartItem[] } = await res.json();
    // Take the server's cleaned copy unless the cart changed again meanwhile.
    if (useCartStore.getState().items === items) useCartStore.getState().applyServer(body.items);
  } catch {
    // Offline: the change stays marked and is sent on the next change or visit.
  }
}

async function loadFromServer() {
  const state = useCartStore.getState();
  // Changes the server doesn't have yet (made offline, or before saving existed) win.
  if (state.dirty) return saveToServer();
  try {
    const res = await fetch("/api/cart", { cache: "no-store" });
    if (!res.ok) return;
    const body: { items: CartItem[]; updatedAt: string | null } = await res.json();
    // Nothing saved for this browser yet (new visitor, or cookies cleared): save what we have.
    if (body.updatedAt === null) {
      if (state.items.length > 0) await saveToServer();
      return;
    }
    // The saved cart is newer (another tab or device, or the browser's copy was cleared).
    const current = useCartStore.getState();
    if (!current.dirty && !sameLines(current.items, body.items)) current.applyServer(body.items);
  } catch {
    // Offline: keep the browser's copy.
  }
}

/**
 * Keeps the browser cart and the saved server cart in step (BUN-175):
 * - on page load and when the tab comes back into view, the saved cart is
 *   loaded (it may have changed on another device once sign-in exists);
 * - every change is saved shortly after it's made;
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
