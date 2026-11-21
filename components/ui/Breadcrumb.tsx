import Link from "next/link";
import { cx } from "@/lib/utils";
import { ChevronRightIcon } from "./icons";

export type BreadcrumbItem = { label: string; href?: string };

/** "Home › Category › Product" trail. The last item is the current page. */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="text-body-sm text-muted-foreground flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-primary underline-offset-2 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cx(isLast && "text-foreground font-semibold")}
                >
                  {item.label}
                </span>
              )}
              {!isLast && <ChevronRightIcon size={14} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
