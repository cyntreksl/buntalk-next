"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { MAX_CART_LINES, MAX_QUANTITY } from "@/lib/cart/limits";

export type CartItem = {
  /** Product + size + Cake Studio design: one line each (see lineKey in lib/cart/limits.ts). */
  key: string;
  productSlug: string;
  /** Chosen size/variant (ERP SKU link_id), for products that have them. */
  skuId?: string;
  name: string;
  /** "1 kg", for a product with sizes/variants. */
  variant?: string;
  /** Cake Studio design (BUN-184): its id and a short summary to show. */
  customization?: { designId: string; summary: string[] };
  /** Last price the ERP gave. For display only; the server re-prices every time. */
  unitPrice: number;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  /** True while there are changes the server copy doesn't have yet (see CartSync). */
  dirty: boolean;
  /** Adds to a line (or creates it). Prefer setLine with the server's checked quantity. */
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  /** Puts a checked line in the cart with exactly this quantity (after POST /api/cart/items). */
  setLine: (item: CartItem) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  /** Replace the cart with the server-priced lines (see features/cart/useServerCart.ts). */
  replaceItems: (items: CartItem[]) => void;
  /** Take the saved server cart (CartSync); not a change to send back. */
  applyServer: (items: CartItem[]) => void;
  markSynced: () => void;
  clear: () => void;
};

const clampQty = (q: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.round(q)));

/**
 * Client-side cart state, persisted to localStorage and saved on the server
 * (BUN-175, see CartSync and GET/PUT /api/cart).
 *
 * Items only get in through the server check (POST /api/cart/items), and the
 * cart and checkout pages re-price them (POST /api/cart/validate). Prices kept
 * here are for display only: totals are always calculated on the server from
 * ERP prices. Quantities stay within 1–99 here too.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      dirty: false,
      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.key === item.key);
          if (existing) {
            return {
              dirty: true,
              items: state.items.map((i) =>
                i.key === item.key
                  ? { ...i, ...item, quantity: clampQty(i.quantity + quantity) }
                  : i,
              ),
            };
          }
          if (state.items.length >= MAX_CART_LINES) return state;
          return {
            dirty: true,
            items: [...state.items, { ...item, quantity: clampQty(quantity) }],
          };
        }),
      setLine: (item) =>
        set((state) => {
          const line = { ...item, quantity: clampQty(item.quantity) };
          const exists = state.items.some((i) => i.key === item.key);
          if (!exists && state.items.length >= MAX_CART_LINES) return state;
          return {
            dirty: true,
            items: exists
              ? state.items.map((i) => (i.key === item.key ? line : i))
              : [...state.items, line],
          };
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          dirty: true,
          items:
            quantity <= 0
              ? state.items.filter((i) => i.key !== key)
              : state.items.map((i) =>
                  i.key === key ? { ...i, quantity: clampQty(quantity) } : i,
                ),
        })),
      removeItem: (key) =>
        set((state) => ({ dirty: true, items: state.items.filter((i) => i.key !== key) })),
      replaceItems: (items) => set({ items, dirty: true }),
      applyServer: (items) => set({ items, dirty: false }),
      markSynced: () => set({ dirty: false }),
      clear: () => set({ items: [], dirty: true }),
    }),
    {
      name: "buntalk-cart",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state) => ({ items: state.items, dirty: state.dirty }),
      migrate: (persisted, version) => {
        const state = persisted as { items?: Record<string, unknown>[]; dirty?: boolean };
        // v0 carts (before sizes) keyed lines by product slug in `sku`.
        if (version === 0 && Array.isArray(state?.items)) {
          return {
            items: state.items.map((i) => ({
              key: String(i.sku),
              productSlug: String(i.sku),
              name: String(i.name),
              unitPrice: Number(i.unitPrice),
              quantity: Number(i.quantity),
            })),
            // Not on the server yet: CartSync saves it.
            dirty: true,
          } as CartState;
        }
        // v1 carts had no server copy yet.
        if (version === 1) return { ...state, dirty: (state.items?.length ?? 0) > 0 } as CartState;
        return persisted as CartState;
      },
    },
  ),
);

export const selectCartCount = (state: CartState) =>
  state.items.reduce((sum, i) => sum + i.quantity, 0);
