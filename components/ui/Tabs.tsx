"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
};

type TabsProps = {
  items: TabItem[];
  /** Tab selected on first render (defaults to the first enabled tab). */
  defaultValue?: string;
  /** Read by screen readers to describe the tab list. */
  label: string;
  className?: string;
};

/**
 * Tabs following the WAI-ARIA pattern: Left/Right arrows move between tabs,
 * Home/End jump to the first/last, and only the selected tab is in the Tab order.
 */
export function Tabs({ items, defaultValue, label, className }: TabsProps) {
  const baseId = useId();
  const enabled = items.filter((item) => !item.disabled);
  const [selected, setSelected] = useState(defaultValue ?? enabled[0]?.id);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  const focusTab = (id: string) => {
    setSelected(id);
    tabRefs.current.get(id)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const index = enabled.findIndex((item) => item.id === selected);
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % enabled.length,
      ArrowLeft: (index - 1 + enabled.length) % enabled.length,
      Home: 0,
      End: enabled.length - 1,
    };
    if (event.key in keys) {
      event.preventDefault();
      focusTab(enabled[keys[event.key]].id);
    }
  };

  return (
    <div className={cx("flex flex-col gap-4", className)}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="border-border flex gap-1 overflow-x-auto border-b"
      >
        {items.map((item) => {
          const isSelected = item.id === selected;
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) tabRefs.current.set(item.id, node);
                else tabRefs.current.delete(item.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={isSelected ? 0 : -1}
              disabled={item.disabled}
              onClick={() => setSelected(item.id)}
              className={cx(
                "text-body -mb-px border-b-2 px-4 py-2.5 font-bold whitespace-nowrap transition-colors",
                isSelected
                  ? "border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground border-transparent",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== selected}
          tabIndex={0}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
