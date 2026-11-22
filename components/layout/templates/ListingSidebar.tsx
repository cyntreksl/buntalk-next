"use client";

import { useState, type ReactNode } from "react";
import { Button, Drawer } from "@/components/ui";

/**
 * Listing sidebar. From desktop (lg) up it is a column next to the grid; on
 * phones and tablets it moves into a drawer opened with a "Filters" button so
 * the grid gets the full width.
 */
export function ListingSidebar({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="lg:hidden">
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog">
          {title}
        </Button>
        <Drawer open={open} onClose={() => setOpen(false)} side="left" title={title}>
          <div onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
            {children}
          </div>
        </Drawer>
      </div>
      <aside aria-label={title} className="hidden lg:block">
        {/* Scrolls on its own when the filters are taller than the screen. */}
        <div className="sticky top-(--sticky-offset) flex max-h-[calc(100dvh-var(--sticky-offset)-1rem)] flex-col gap-6 overflow-y-auto pr-1 pb-4">
          {children}
        </div>
      </aside>
    </>
  );
}
