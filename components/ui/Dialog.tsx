"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "@/lib/utils";
import { CloseIcon } from "./icons";

type DialogBaseProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons along the bottom, e.g. Cancel / Confirm. */
  footer?: ReactNode;
  className?: string;
};

/**
 * Shared behaviour for Dialog and Drawer, built on the native <dialog> element:
 * it traps focus, closes on Esc, returns focus to the opening button and hides
 * the rest of the page from screen readers. Clicking the backdrop also closes it.
 */
function useModalDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden"; // stop the page scrolling behind
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return {
    ref,
    // Esc fires "cancel"; let the parent decide by calling onClose.
    onCancel: (event: React.SyntheticEvent) => {
      event.preventDefault();
      onClose();
    },
    // A click on the <dialog> itself (not its content) is a click on the backdrop.
    onClick: (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
  };
}

function DialogHeader({
  titleId,
  descriptionId,
  title,
  description,
  onClose,
}: {
  titleId: string;
  descriptionId: string;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-h3">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="text-body-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="text-muted-foreground hover:bg-surface-muted hover:text-foreground -m-1 rounded-sm p-1"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

const dialogBase =
  "bg-surface text-foreground backdrop:bg-sand-950/50 m-0 max-h-none max-w-none p-0 shadow-lg backdrop:backdrop-blur-[2px]";

/** Centred modal dialog. Control it with `open` / `onClose`. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: DialogBaseProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogProps = useModalDialog(open, onClose);

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cx(
        dialogBase,
        "top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col gap-5 overflow-y-auto p-5 md:p-6">
          <DialogHeader {...{ titleId, descriptionId, title, description, onClose }} />
          {children && <div>{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>
          )}
        </div>
      )}
    </dialog>
  );
}

const sides = {
  right: "top-0 right-0 left-auto h-dvh w-[min(24rem,100%)]",
  left: "top-0 left-0 h-dvh w-[min(24rem,100%)]",
  bottom: "top-auto bottom-0 left-0 max-h-[85dvh] w-full rounded-t-xl",
};

/** Panel that slides over the page from an edge: cart, filters, mobile menu. */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "right",
  className,
}: DialogBaseProps & { side?: keyof typeof sides }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogProps = useModalDialog(open, onClose);

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cx(dialogBase, sides[side], className)}
    >
      {open && (
        <div className="flex h-full max-h-[inherit] flex-col">
          <div className="border-border border-b p-5">
            <DialogHeader {...{ titleId, descriptionId, title, description, onClose }} />
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
          {footer && <div className="border-border flex flex-col gap-2 border-t p-5">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
