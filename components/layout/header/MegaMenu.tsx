"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { ChevronDownIcon, MenuIcon, useDismiss } from "@/components/ui";
import type { CategoryNode } from "@/lib/erp";
import { cx } from "@/lib/utils";

/** How many categories to show as direct links in the bar; the rest are in "All categories". */
const INLINE_LIMIT = 6;

/**
 * Desktop category navigation (lg+): an "All categories" button that opens a
 * full-width panel of every category, followed by direct links to the first
 * few top-level categories. Categories come from the ERP (passed in by
 * SiteHeader as a tree, in ERP order); the panel lists sub-categories under
 * their parent.
 *
 * The panel is a disclosure (button with aria-expanded): Tab moves through
 * its links; Esc, clicking outside or tabbing away closes it.
 */
export function MegaMenu({ categories }: { categories: CategoryNode[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(containerRef, open, close, buttonRef);

  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const linkClasses = (href: string) =>
    cx(
      "text-body-sm inline-flex h-12 items-center border-b-2 px-3 font-semibold whitespace-nowrap transition-colors",
      pathname === href
        ? "border-primary text-primary"
        : "text-muted-foreground hover:text-foreground border-transparent",
    );

  return (
    <div ref={containerRef}>
      <ul className="flex items-center gap-1">
        <li>
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className={cx(
              "text-body-sm inline-flex h-9 items-center gap-2 rounded-full px-4 font-bold transition-colors",
              open
                ? "bg-secondary text-secondary-foreground"
                : "bg-surface-muted text-foreground hover:bg-border",
            )}
          >
            <MenuIcon size={16} />
            All categories
            <ChevronDownIcon
              size={16}
              className={cx("transition-transform", open && "rotate-180")}
            />
          </button>
        </li>
        {categories.slice(0, INLINE_LIMIT).map((category) => (
          <li key={category.slug}>
            <Link
              href={`/category/${category.slug}`}
              prefetch={true}
              aria-current={pathname === `/category/${category.slug}` ? "page" : undefined}
              className={linkClasses(`/category/${category.slug}`)}
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>

      <div
        id={panelId}
        hidden={!open}
        className="border-border bg-surface absolute inset-x-0 top-full z-40 border-t border-b shadow-lg"
      >
        <div className="max-w-page mx-auto grid gap-x-8 gap-y-2 px-6 py-6 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category) => (
            <div key={category.slug} className="flex flex-col">
              <Link
                href={`/category/${category.slug}`}
                prefetch={true}
                className="hover:bg-surface-muted group flex flex-col rounded-md p-3"
              >
                <span className="group-hover:text-primary font-bold">{category.name}</span>
                <span className="text-body-sm text-muted-foreground line-clamp-2">
                  {category.description}
                </span>
              </Link>
              {category.children.length > 0 && (
                <ul className="mb-2 flex flex-col pl-3">
                  {category.children.map((child) => (
                    <li key={child.slug}>
                      <Link
                        href={`/category/${child.slug}`}
                        prefetch={true}
                        className="text-body-sm text-foreground hover:text-primary block rounded-sm px-3 py-1.5"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
