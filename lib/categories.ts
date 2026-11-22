import type { Category, CategoryNode } from "@/lib/erp";

/**
 * Category helpers (pure, usable on the server and in the browser).
 *
 * Order: categories are shown exactly in the ERP's order (`sortOrder`, lower
 * first). Categories without a sortOrder keep the order the ERP sent them in,
 * after those with one. Nothing is ever re-sorted by name.
 */

export function sortByErpOrder<T extends Pick<Category, "sortOrder">>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const sa = a.item.sortOrder ?? Number.POSITIVE_INFINITY;
      const sb = b.item.sortOrder ?? Number.POSITIVE_INFINITY;
      return sa === sb ? a.index - b.index : sa - sb;
    })
    .map(({ item }) => item);
}

/**
 * Builds the category tree. A category whose parent is missing or inactive is
 * shown at the top level, so it never disappears from the menu.
 */
export function buildCategoryTree(categories: Category[]): CategoryNode[] {
  const nodes = new Map<string, CategoryNode>();
  for (const c of categories) nodes.set(c.id ?? c.slug, { ...c, children: [] });

  const roots: CategoryNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    // Guard against a category listed as its own parent.
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }

  const sortTree = (list: CategoryNode[]): CategoryNode[] =>
    sortByErpOrder(list).map((n) => ({ ...n, children: sortTree(n.children) }));
  return sortTree(roots);
}

/** Top-level categories only, in ERP order (for compact menus). */
export function topLevelCategories(categories: Category[]): Category[] {
  const ids = new Set(categories.map((c) => c.id ?? c.slug));
  // A category is top-level if it has no parent, or its parent isn't in the list.
  return sortByErpOrder(categories.filter((c) => !c.parentId || !ids.has(c.parentId)));
}

/**
 * The category and its ancestors, root first: [Cakes, Birthday cakes].
 * Stops on loops in bad data.
 */
export function categoryTrail(categories: Category[], slug: string): Category[] {
  const byId = new Map(categories.map((c) => [c.id ?? c.slug, c]));
  const trail: Category[] = [];
  const seen = new Set<string>();
  let current = categories.find((c) => c.slug === slug);
  while (current && !seen.has(current.slug)) {
    seen.add(current.slug);
    trail.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return trail;
}

/** Slugs of a category and all its sub-categories. */
export function descendantSlugs(categories: Category[], slug: string): string[] {
  const tree = buildCategoryTree(categories);
  const find = (nodes: CategoryNode[]): CategoryNode | undefined => {
    for (const n of nodes) {
      if (n.slug === slug) return n;
      const hit = find(n.children);
      if (hit) return hit;
    }
  };
  const collect = (n: CategoryNode): string[] => [n.slug, ...n.children.flatMap(collect)];
  const node = find(tree);
  return node ? collect(node) : [slug];
}
