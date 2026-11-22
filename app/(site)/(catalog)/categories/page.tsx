import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, BagIcon } from "@/components/ui";
import { buildCategoryTree } from "@/lib/categories";
import { getCategories } from "@/lib/erp";

// All categories (BUN-168): every visible ERP category, top level first with
// its sub-categories under it, all in the ERP's order. Static + ISR ("catalog"
// profile); refreshed with the catalog when the ERP changes a category.

// Same for every visitor: the complete page must be prerendered (stricter than
// the catalog layout's 'prefetch'). See app/(site)/(catalog)/layout.tsx.
export const ensureStatic = "navigation";

export const metadata: Metadata = {
  title: "All categories",
  description: "Browse every Buntalk category: buns, cakes, short eats and more.",
};

export default async function CategoriesPage() {
  const tree = buildCategoryTree(await getCategories());

  return (
    <Container className="flex flex-col gap-6 py-8 md:gap-8 md:py-12">
      <PageHeader
        title="All categories"
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Categories" }]}
      />
      {tree.length === 0 ? (
        <EmptyState
          icon={<BagIcon size={32} />}
          title="No categories yet"
          description={<p>Our menu is being updated. Please check back soon.</p>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tree.map((category) => (
            <li
              key={category.slug}
              className="bg-surface-muted flex flex-col gap-4 rounded-2xl p-5"
            >
              <Link
                href={`/category/${category.slug}`}
                prefetch={true}
                className="group flex items-center gap-4"
              >
                <span className="bg-surface text-accent-soft-foreground font-display text-h2 relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full font-bold">
                  {category.imageUrl ? (
                    // TODO(BUN-238): add the ERP image host to images.remotePatterns and drop `unoptimized`.
                    <Image
                      src={category.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="64px"
                      className="object-cover"
                    />
                  ) : (
                    <span aria-hidden="true">{category.name.charAt(0)}</span>
                  )}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-h4 text-foreground group-hover:text-primary">
                    {category.name}
                  </span>
                  {category.description && (
                    <span className="text-body-sm text-muted-foreground line-clamp-2">
                      {category.description}
                    </span>
                  )}
                </span>
              </Link>
              {category.children.length > 0 && (
                <ul aria-label={`${category.name} sub-categories`} className="flex flex-wrap gap-2">
                  {category.children.map((child) => (
                    <li key={child.slug}>
                      <Link
                        href={`/category/${child.slug}`}
                        prefetch={true}
                        className="bg-surface text-body-sm hover:text-primary inline-flex h-9 items-center rounded-full px-4 font-semibold"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
