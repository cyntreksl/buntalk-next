"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes a popup (menu, dropdown) when the user presses Escape, clicks
 * outside it, or moves keyboard focus out of it. On Escape, focus goes back
 * to `returnFocusTo` (usually the button that opened it).
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
  returnFocusTo?: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        returnFocusTo?.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open, close, ref, returnFocusTo]);
}
