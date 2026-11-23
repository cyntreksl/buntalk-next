"use client";

import { create } from "zustand";

type MiniCartState = {
  open: boolean;
  /** The line just added, highlighted in the drawer. */
  lastAddedKey: string | null;
  show: (lastAddedKey?: string) => void;
  close: () => void;
};

/** Open state of the mini-cart drawer (BUN-176). "Add to cart" opens it. */
export const useMiniCart = create<MiniCartState>()((set) => ({
  open: false,
  lastAddedKey: null,
  show: (lastAddedKey) => set({ open: true, lastAddedKey: lastAddedKey ?? null }),
  close: () => set({ open: false }),
}));
