import Link from "next/link";
import { buildCategoryTree } from "@/lib/categories";
import type { Category, CategoryNode } from "@/lib/erp";
import { cx } from "@/lib/utils";

function CategoryList({
  nodes,
  current,
  depth,
}: {
  nodes: CategoryNode[];
  current?: string;
  depth: number;
}) {
  return (
    <ul className={cx("flex flex-col gap-1", depth > 0 && "border-border ml-3 border-l pl-2")}>
      {nodes.map((category) => {
        const isCurrent = category.slug === current;
        return (
          <li key={category.slug} className="flex flex-col gap-1">
            <Link
              href={`/category/${category.slug}`}
              prefetch={true}
              aria-current={isCurrent ? "page" : undefined}
              className={cx(
                "block rounded-md px-3 py-2",
                depth === 0 ? "font-semibold" : "text-body-sm",
                isCurrent
                  ? "bg-accent-soft text-accent-soft-foreground font-semibold"
                  : "text-foreground hover:bg-surface-muted",
              )}
            >
              {category.name}
            </Link>
            {category.children.length > 0 && (
              <CategoryList nodes={category.children} current={current} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Category tree for the listing sidebar, in the ERP's order, with
 * sub-categories nested under their parent. The current one is highlighted.
 */
export function CategoryNav({ categories, current }: { categories: Category[]; current?: string }) {
  return (
    <nav aria-label="Categories" className="flex flex-col gap-2">
      <h2 className="text-h4">Categories</h2>
      <CategoryList nodes={buildCategoryTree(categories)} current={current} depth={0} />
    </nav>
  );
}
