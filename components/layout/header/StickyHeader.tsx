"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cx } from "@/lib/utils";

/**
 * Keeps the header at the top of the screen while scrolling, and adds a
 * shadow once the page has scrolled so the header separates from the content.
 */
export function StickyHeader({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cx(
        "border-border bg-surface sticky top-0 z-40 border-b transition-shadow",
        scrolled && "shadow-md",
      )}
    >
      {children}
    </header>
  );
}
