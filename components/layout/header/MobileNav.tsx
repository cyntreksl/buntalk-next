"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { accountNav } from "@/features/account/nav";
import { Drawer, MenuIcon } from "@/components/ui";
import type { CategoryNode } from "@/lib/erp";
import { cx } from "@/lib/utils";
import { useSessionStatus } from "./AccountMenu";

/**
 * Mobile and tablet navigation (below lg): a hamburger button that opens a
 * drawer with categories, account links and the language slot. (Search
 * sits in the header itself, under the top row.)
 *
 * The drawer is the shared <Drawer> (native <dialog>): focus moves into it,
 * Tab stays inside, Esc or the close button closes it, and focus returns to
 * the hamburger button. It also closes when a link inside is followed.
 */
export function MobileNav({
  categories,
  search,
  languageSwitcher,
}: {
  /** Category tree in ERP order. */
  categories: CategoryNode[];
  /** Optional search box inside the drawer. */
  search?: ReactNode;
  languageSwitcher: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  const { data } = useSessionStatus();
  const signedIn = data?.signedIn ?? false;

  const itemClasses = (href: string) =>
    cx(
      "block rounded-md px-3 py-2.5 font-bold",
      pathname === href ? "bg-accent-soft text-accent-soft-foreground" : "hover:bg-surface-muted",
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="text-foreground hover:bg-surface-muted inline-flex size-10 items-center justify-center rounded-md"
      >
        <MenuIcon size={24} />
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} side="left" title="Menu">
        <div className="flex flex-col gap-6">
          {search}
          <nav aria-label="Categories" className="flex flex-col gap-1">
            <h3 className="text-caption text-muted-foreground mb-1 font-bold tracking-wider uppercase">
              Categories
            </h3>
            <ul>
              {categories.map((category) => {
                const href = `/category/${category.slug}`;
                return (
                  <li key={category.slug}>
                    <Link
                      href={href}
                      aria-current={pathname === href ? "page" : undefined}
                      className={itemClasses(href)}
                    >
                      {category.name}
                    </Link>
                    {category.children.length > 0 && (
                      <ul className="border-border ml-3 border-l pl-2">
                        {category.children.map((child) => {
                          const childHref = `/category/${child.slug}`;
                          return (
                            <li key={child.slug}>
                              <Link
                                href={childHref}
                                aria-current={pathname === childHref ? "page" : undefined}
                                className={cx(itemClasses(childHref), "text-body-sm font-semibold")}
                              >
                                {child.name}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
          <nav aria-label="Account" className="flex flex-col gap-1">
            <h3 className="text-caption text-muted-foreground mb-1 font-bold tracking-wider uppercase">
              Account
            </h3>
            <ul>
              {signedIn ? (
                accountNav.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className={itemClasses(item.href)}>
                      {item.label}
                    </Link>
                  </li>
                ))
              ) : (
                <li>
                  {/* TODO(BUN-186): link to the sign-in page. */}
                  <Link href="/account" className={itemClasses("/account")}>
                    Sign in
                  </Link>
                </li>
              )}
              <li>
                <Link href="/cart" className={itemClasses("/cart")}>
                  Cart
                </Link>
              </li>
            </ul>
          </nav>
          <div className="border-border border-t pt-4">{languageSwitcher}</div>
        </div>
      </Drawer>
    </>
  );
}
