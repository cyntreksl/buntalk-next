import Image from "next/image";
import Link from "next/link";
import { buildCategoryTree } from "@/lib/categories";
import type { Category, CategoryNode } from "@/lib/erp";

function findNode(nodes: CategoryNode[], slug: string): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return node;
    const hit = findNode(node.children, slug);
    if (hit) return hit;
  }
}

function findParent(
  nodes: CategoryNode[],
  slug: string,
  parent?: CategoryNode,
): CategoryNode | undefined {
  for (const node of nodes) {
    if (node.slug === slug) return parent;
    const hit = findParent(node.children, slug, node);
    if (hit) return hit;
  }
}

/**
 * Sub-category links under the category header (BUN-168), in the ERP's order:
 * the category's own sub-categories, or, for a category without any, its
 * sister categories ("More in Cakes"), so customers can always move sideways.
 * Nothing is shown for a top-level category without sub-categories.
 */
export function SubcategoryLinks({
  categories,
  current,
}: {
  categories: Category[];
  current: string;
}) {
  const tree = buildCategoryTree(categories);
  const node = findNode(tree, current);
  if (!node) return null;

  const parent = node.children.length === 0 ? findParent(tree, current) : undefined;
  const links =
    node.children.length > 0
      ? node.children
      : (parent?.children ?? []).filter((c) => c.slug !== current);
  if (links.length === 0) return null;

  const title = node.children.length > 0 ? `Shop ${node.name}` : `More in ${parent!.name}`;
  return (
    <nav aria-label={title} className="flex flex-col gap-3">
      <h2 className="text-body-sm text-muted-foreground font-bold">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {links.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/category/${category.slug}`}
              prefetch={true}
              className="border-border bg-surface hover:border-accent hover:text-primary text-body-sm inline-flex h-10 items-center gap-2 rounded-full border py-1 pr-4 pl-1 font-semibold transition-colors"
            >
              <span className="bg-surface-muted text-accent-soft-foreground relative flex size-8 items-center justify-center overflow-hidden rounded-full font-bold">
                {category.imageUrl ? (
                  // TODO(BUN-238): add the ERP image host to images.remotePatterns and drop `unoptimized`.
                  <Image
                    src={category.imageUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="32px"
                    className="object-cover"
                  />
                ) : (
                  <span aria-hidden="true">{category.name.charAt(0)}</span>
                )}
              </span>
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
