"use client";

import { useEffect, useRef, useState } from "react";
import {
  validateCart,
  type AppliedScheme,
  type FreeItem,
  type LineLimits,
  type RemovedReasonCode,
} from "./api";
import { useCartStore, type CartItem } from "./store";

export type RemovedNotice = {
  name: string;
  reason: RemovedReasonCode;
};

export type ServerCartState = {
  /** "checking" while the server is re-pricing; "error" if it couldn't (offline, ERP down). */
  status: "checking" | "ready" | "error";
  currency: string;
  /** Server totals from ERP prices and the ERP scheme engine. Null until a check finishes. */
  totals: { subtotal: number; discountTotal: number; total: number } | null;
  /** Server line totals and scheme discounts by line key. */
  lines: Record<string, LinePricing>;
  /** Schemes the ERP applied (which scheme gave which discount). */
  appliedSchemes: AppliedScheme[];
  freeItems: FreeItem[];
  /** Lines the server dropped (hidden, sold out), for the notice. */
  removed: RemovedNotice[];
  /** Lines whose quantity was over the limit and was lowered (names), for a notice. */
  adjusted: string[];
};

export type LinePricing = {
  /** Before offers. */
  lineSubtotal: number;
  lineTotal: number;
  discount: number;
  schemes: { id: string; name: string }[];
  /** Allowed quantities (for the quantity stepper). */
  limits: LineLimits;
};

type Priced = {
  /** The cart (lines × quantities) these numbers belong to. */
  signature: string;
  failed: boolean;
  currency: string;
  totals: ServerCartState["totals"];
  lines: Record<string, LinePricing>;
  appliedSchemes: AppliedScheme[];
  freeItems: FreeItem[];
};

const signature = (items: CartItem[]) => items.map((i) => `${i.key}×${i.quantity}`).join("|");

/**
 * Keeps the browser cart priced by the server. When the cart opens, and
 * whenever a line or quantity changes, the server re-prices it from the ERP:
 * names and unit prices are refreshed, hidden or sold-out lines are dropped,
 * and the subtotal comes from the server. The browser never adds up prices
 * that the customer is charged.
 */
export function useServerCart(enabled: boolean): ServerCartState {
  const items = useCartStore((s) => s.items);
  const sig = signature(items);
  const [priced, setPriced] = useState<Priced>({
    signature: "",
    failed: false,
    currency: "LKR",
    totals: null,
    lines: {},
    appliedSchemes: [],
    freeItems: [],
  });
  const [removed, setRemoved] = useState<RemovedNotice[]>([]);
  const [adjusted, setAdjusted] = useState<string[]>([]);
  // Cart signatures already sent to the server, so dropping lines doesn't trigger another check.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || items.length === 0 || sig === handled.current) return;
    handled.current = sig;
    const sent = useCartStore.getState().items;
    let cancelled = false;

    // Short pause so tapping "+" several times sends one request.
    const timer = setTimeout(async () => {
      const result = await validateCart(sent);
      if (cancelled) return;
      if (!result) {
        setPriced((p) => ({ ...p, signature: sig, failed: true }));
        return;
      }

      const byKey = new Map(result.items.map((i) => [i.key, i]));
      const reasons = new Map(result.removed.map((r) => [r.key, r.reason]));

      // Apply ERP names and prices; keep quantities the visitor changed meanwhile.
      const latest = useCartStore.getState().items;
      const next = latest
        .filter((i) => !reasons.has(i.key))
        .map((i) => {
          const p = byKey.get(i.key);
          if (!p) return i;
          // A quantity over the line's limit is lowered to what the server allows.
          const quantity = p.adjusted ? p.quantity : i.quantity;
          return { ...i, name: p.name, variant: p.variant, unitPrice: p.unitPrice, quantity };
        });
      const lowered = result.items.filter((i) => i.adjusted).map((i) => i.name);
      if (lowered.length > 0) setAdjusted((a) => [...new Set([...a, ...lowered])]);
      const nextSig = signature(next);
      // Nothing changed meanwhile: the remaining lines are exactly what was priced.
      if (signature(latest) === sig) handled.current = nextSig;
      if (reasons.size > 0) {
        const dropped = sent
          .filter((i) => reasons.has(i.key))
          .map((i) => ({
            name: i.variant ? `${i.name} (${i.variant})` : i.name,
            reason: reasons.get(i.key)!,
          }));
        setRemoved((r) => [...r, ...dropped]);
      }
      useCartStore.getState().replaceItems(next);
      setPriced({
        signature: signature(latest) === sig ? nextSig : sig,
        failed: false,
        currency: result.currency,
        totals: {
          subtotal: result.subtotal,
          discountTotal: result.discountTotal,
          total: result.total,
        },
        lines: Object.fromEntries(
          result.items.map((i) => [
            i.key,
            {
              lineSubtotal: i.lineSubtotal,
              lineTotal: i.lineTotal,
              discount: i.discount,
              schemes: i.schemes,
              limits: i.limits,
            },
          ]),
        ),
        appliedSchemes: result.appliedSchemes,
        freeItems: result.freeItems,
      });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Let the cleanup's re-run send this cart again if it was cancelled before sending.
      if (handled.current === sig) handled.current = null;
    };
  }, [enabled, sig, items.length]);

  const upToDate = priced.signature === sig;
  return {
    status: upToDate ? (priced.failed ? "error" : "ready") : "checking",
    currency: priced.currency,
    totals: upToDate && !priced.failed ? priced.totals : null,
    lines: upToDate ? priced.lines : {},
    appliedSchemes: upToDate ? priced.appliedSchemes : [],
    freeItems: upToDate ? priced.freeItems : [],
    removed,
    adjusted,
  };
}

export function removedNoticeText(removed: RemovedNotice[]): string | null {
  if (removed.length === 0) return null;
  const names = removed.map((r) => r.name).join(", ");
  if (removed.every((r) => r.reason === "customize_first")) {
    return `${names} ${removed.length === 1 ? "needs" : "need"} to be designed in Cake Studio first and ${
      removed.length === 1 ? "was" : "were"
    } removed from your cart.`;
  }
  const soldOut = removed.every((r) => r.reason === "sold_out");
  const verb = removed.length === 1 ? "was" : "were";
  return soldOut
    ? `${names} ${removed.length === 1 ? "is" : "are"} sold out and ${verb} removed from your cart.`
    : `${names} ${removed.length === 1 ? "is" : "are"} no longer available online and ${verb} removed from your cart.`;
}
