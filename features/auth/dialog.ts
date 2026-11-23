"use client";

import { create } from "zustand";

export type AuthMode = "sign-in" | "sign-up";

/** The shared sign-in / sign-up dialog (BUN-186), opened from anywhere (header, checkout). */
export const useAuthDialog = create<{
  open: boolean;
  mode: AuthMode;
  /** Where to go after signing in; staying on the page when not set. */
  next?: string;
  show: (mode?: AuthMode, next?: string) => void;
  setMode: (mode: AuthMode) => void;
  close: () => void;
}>((set) => ({
  open: false,
  mode: "sign-in",
  show: (mode = "sign-in", next) => set({ open: true, mode, next }),
  setMode: (mode) => set({ mode }),
  close: () => set({ open: false }),
}));
