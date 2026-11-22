import Link from "next/link";
import { topLevelCategories } from "@/lib/categories";
import { getNavigationCategories } from "@/lib/erp";

/**
 * "Popular categories" links for 404 pages and empty states. Uses the
 * never-failing navigation read, so it simply hides itself if the ERP is down.
 */
export async function CategorySuggestions({
  title = "Popular categories",
  limit = 6,
}: {
  title?: string;
  limit?: number;
}) {
  const categories = topLevelCategories(await getNavigationCategories()).slice(0, limit);
  if (categories.length === 0) return null;
  return (
    <nav aria-label={title} className="flex flex-col items-center gap-3">
      <h2 className="text-body-sm text-muted-foreground font-bold tracking-wider uppercase">
        {title}
      </h2>
      <ul className="flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              href={`/category/${category.slug}`}
              prefetch={true}
              className="border-accent bg-accent-soft text-accent-soft-foreground hover:bg-accent hover:text-accent-foreground inline-block rounded-full border px-4 py-1.5 font-semibold"
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
