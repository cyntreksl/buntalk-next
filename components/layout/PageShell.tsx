import type { ReactNode } from "react";

export const MAIN_CONTENT_ID = "main-content";

type PageShellProps = {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
};

/**
 * The frame every page sits in: header slot, main content area, footer slot.
 *
 * - A "Skip to content" link is the first focusable element, so keyboard users
 *   can jump past the header.
 * - <main> grows to fill the screen, so the footer stays at the bottom on short pages.
 * - min-w-0 and overflow-x-clip stop wide content from causing sideways scrolling
 *   on small (360px) screens.
 *
 * Used by app/(site)/layout.tsx (full header) and app/(checkout)/layout.tsx
 * (minimal header).
 */
export function PageShell({ header, footer, children }: PageShellProps) {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col overflow-x-clip">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="bg-primary text-primary-foreground sr-only z-50 rounded-md px-4 py-2 font-bold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      {header}
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col outline-none"
      >
        {children}
      </main>
      {footer}
    </div>
  );
}
