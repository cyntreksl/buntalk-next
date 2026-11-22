"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CartItem = {
  /** Product + size: one line per product size (see lineKey in lib/cart.server.ts). */
  key: string;
  productSlug: string;
  /** Chosen size/variant (ERP SKU link_id), for products that have them. */
  skuId?: string;
  name: string;
  /** "1 kg", for a product with sizes/variants. */
  variant?: string;
  /** Last price the ERP gave. For display only; the server re-prices every time. */
  unitPrice: number;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  /** Replace the cart with the server-priced lines (see features/cart/useServerCart.ts). */
  replaceItems: (items: CartItem[]) => void;
  clear: () => void;
};

/**
 * Client-side cart state, persisted to localStorage.
 *
 * Items only get in through the server check (POST /api/cart/items), and the
 * cart and checkout pages re-price them (POST /api/cart/validate). Prices kept
 * here are for display only: totals are always calculated on the server from
 * ERP prices.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find((i) => i.key === item.key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.key === item.key ? { ...i, ...item, quantity: i.quantity + quantity } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, quantity }] };
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.key !== key)
              : state.items.map((i) => (i.key === key ? { ...i, quantity } : i)),
        })),
      removeItem: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      replaceItems: (items) => set({ items }),
      clear: () => set({ items: [] }),
    }),
    {
      name: "buntalk-cart",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // v0 carts (before sizes) keyed lines by product slug in `sku`.
      migrate: (persisted, version) => {
        const state = persisted as { items?: Record<string, unknown>[] };
        if (version === 0 && Array.isArray(state?.items)) {
          return {
            items: state.items.map((i) => ({
              key: String(i.sku),
              productSlug: String(i.sku),
              name: String(i.name),
              unitPrice: Number(i.unitPrice),
              quantity: Number(i.quantity),
            })),
          } as CartState;
        }
        return persisted as CartState;
      },
    },
  ),
);

export const selectCartCount = (state: CartState) =>
  state.items.reduce((sum, i) => sum + i.quantity, 0);
