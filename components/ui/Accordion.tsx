import type { ReactNode } from "react";
import { cx } from "@/lib/utils";
import { ChevronDownIcon } from "./icons";

export type AccordionItem = {
  id: string;
  title: ReactNode;
  content: ReactNode;
  defaultOpen?: boolean;
};

type AccordionProps = {
  items: AccordionItem[];
  /** Give items the same name to allow only one open at a time. */
  single?: boolean;
  className?: string;
};

/**
 * Expandable sections built on native <details>/<summary>: keyboard and
 * screen reader support come from the browser, it works without JavaScript,
 * and the browser's find-in-page opens closed sections.
 */
export function Accordion({ items, single = false, className }: AccordionProps) {
  const groupName = single ? `accordion-${items.map((i) => i.id).join("-")}` : undefined;
  return (
    <div
      className={cx("border-border bg-surface divide-border divide-y rounded-lg border", className)}
    >
      {items.map((item) => (
        <details key={item.id} name={groupName} open={item.defaultOpen} className="group">
          <summary className="text-body hover:bg-surface-muted flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 font-bold [&::-webkit-details-marker]:hidden">
            {item.title}
            <ChevronDownIcon className="text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="text-body text-muted-foreground px-4 pb-4">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
