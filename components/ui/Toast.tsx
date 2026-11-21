"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { cx } from "@/lib/utils";
import { AlertCircleIcon, CheckCircleIcon, CloseIcon, InfoIcon } from "./icons";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
};

type ToastState = {
  toasts: ToastItem[];
  show: (toast: Omit<ToastItem, "id">) => number;
  dismiss: (id: number) => void;
};

let nextId = 1;

const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  show: (toast) => {
    const id = nextId++;
    // Keep at most 3 on screen.
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }].slice(-3) }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Show a short message in the corner of the screen. Call from any client code:
 *
 *   toast.success("Added to cart")
 *   toast.error("Payment failed", "Please try another card.")
 */
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().show({ tone: "success", title, description }),
  error: (title: string, description?: string) =>
    useToastStore.getState().show({ tone: "error", title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().show({ tone: "info", title, description }),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
};

const tones: Record<ToastTone, { className: string; Icon: typeof InfoIcon }> = {
  success: { className: "text-success", Icon: CheckCircleIcon },
  error: { className: "text-danger", Icon: AlertCircleIcon },
  info: { className: "text-info", Icon: InfoIcon },
};

const AUTO_DISMISS_MS = 5000;

function ToastCard({ item }: { item: ToastItem }) {
  const dismiss = useToastStore((s) => s.dismiss);
  // Errors stay until dismissed so they aren't missed; others close after 5 seconds.
  useEffect(() => {
    if (item.tone === "error") return;
    const timer = setTimeout(() => dismiss(item.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [item.id, item.tone, dismiss]);

  const { className, Icon } = tones[item.tone];
  return (
    <li
      role={item.tone === "error" ? "alert" : "status"}
      className="border-border bg-surface pointer-events-auto flex w-full items-start gap-3 rounded-lg border p-4 shadow-lg"
    >
      <Icon className={cx("mt-0.5 shrink-0", className)} />
      <div className="flex flex-1 flex-col gap-0.5">
        <p className="text-body font-bold">{item.title}</p>
        {item.description && (
          <p className="text-body-sm text-muted-foreground">{item.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Dismiss notification"
        className="text-muted-foreground hover:text-foreground -m-1 rounded-sm p-1"
      >
        <CloseIcon size={18} />
      </button>
    </li>
  );
}

/** Renders the toasts. Mounted once in app/providers.tsx. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <ol
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:right-4 sm:left-auto sm:w-96"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </ol>
  );
}
