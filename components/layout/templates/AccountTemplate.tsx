import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/utils";
import { Container } from "../Container";
import { PageHeader } from "../PageHeader";

export const accountNav = [
  { id: "overview", label: "Overview", href: "/account" },
  { id: "orders", label: "Orders", href: "/account/orders" },
  { id: "addresses", label: "Addresses", href: "/account/addresses" },
  { id: "profile", label: "Profile", href: "/account/profile" },
] as const;

export type AccountSection = (typeof accountNav)[number]["id"];

type AccountTemplateProps = {
  /** Which menu item is the current page. */
  active: AccountSection;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
};

/**
 * Account template.
 *
 * - Phone/tablet: the account menu is a row of tabs above the content that
 *   scrolls sideways inside itself if it doesn't fit (the page never does).
 * - Desktop (lg+): the menu is a side column on the left.
 */
export function AccountTemplate({ active, title, description, children }: AccountTemplateProps) {
  return (
    <Container className="flex flex-col gap-6 py-8 md:py-12">
      <PageHeader title={title} description={description} />
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Account" className="min-w-0">
          <ul className="border-border -mx-4 flex gap-1 overflow-x-auto border-b px-4 lg:mx-0 lg:flex-col lg:border-b-0 lg:px-0">
            {accountNav.map((item) => {
              const current = item.id === active;
              return (
                <li key={item.id} className="shrink-0">
                  <Link
                    href={item.href}
                    aria-current={current ? "page" : undefined}
                    className={cx(
                      "text-body block font-bold whitespace-nowrap",
                      "-mb-px border-b-2 px-3 py-2.5 lg:mb-0 lg:rounded-md lg:border-b-0",
                      current
                        ? "border-primary text-primary lg:bg-accent-soft"
                        : "text-muted-foreground hover:text-foreground lg:hover:bg-surface-muted border-transparent",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </Container>
  );
}
