import Link from "next/link";
import type { Category } from "@/lib/erp";
import { cx } from "@/lib/utils";

/** List of categories for the listing sidebar. The current one is highlighted. */
export function CategoryNav({ categories, current }: { categories: Category[]; current?: string }) {
  return (
    <nav aria-label="Categories" className="flex flex-col gap-2">
      <h2 className="text-h4">Categories</h2>
      <ul className="flex flex-col gap-1">
        {categories.map((category) => {
          const isCurrent = category.slug === current;
          return (
            <li key={category.slug}>
              <Link
                href={`/category/${category.slug}`}
                prefetch={true}
                aria-current={isCurrent ? "page" : undefined}
                className={cx(
                  "block rounded-md px-3 py-2 font-semibold",
                  isCurrent
                    ? "bg-accent-soft text-accent-soft-foreground"
                    : "text-foreground hover:bg-surface-muted",
                )}
              >
                {category.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
