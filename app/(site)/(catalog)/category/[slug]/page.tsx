import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingTemplate } from "@/components/layout/templates";
import { BagIcon, EmptyState, buttonClasses } from "@/components/ui";
import { CategoryNav, ProductGrid } from "@/features/catalog";
import { categoryTrail } from "@/lib/categories";
import { getCategories, getCategory, getProductsByCategory } from "@/lib/erp";

// Category: listing template. Static + ISR, "catalog" cache profile (refreshes every 15 min) — see README.

// The page reads `params` before rendering so its HTML is always complete
// (no loading placeholder, see the (catalog) layout). That intentionally blocks
// on the URL, so skip Next's dev-time "instant navigation" check for it.
// Links to categories use prefetch={true}, so navigations are still fast.
export const instant = false;

/** Prerender every category at build time. New categories are built on their first visit. */
export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/category/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Page not found" };
  return { title: category.name, description: category.description };
}

export default async function CategoryPage({ params }: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const [category, categories, products] = await Promise.all([
    getCategory(slug),
    getCategories(),
    getProductsByCategory(slug),
  ]);
  if (!category) notFound();

  return (
    <ListingTemplate
      title={category.name}
      description={category.description}
      breadcrumb={[
        { label: "Home", href: "/" },
        // Parent categories first, then this one (not a link: it is the current page).
        ...categoryTrail(categories, category.slug)
          .slice(0, -1)
          .map((c) => ({ label: c.name, href: `/category/${c.slug}` })),
        { label: category.name },
      ]}
      sidebarTitle="Categories"
      sidebar={<CategoryNav categories={categories} current={category.slug} />}
      toolbar={
        <p className="text-body-sm text-muted-foreground">
          {products.length} product{products.length === 1 ? "" : "s"}
        </p>
      }
    >
      <ProductGrid
        products={products}
        empty={
          <EmptyState
            icon={<BagIcon size={32} />}
            title="No products here yet"
            description={<p>This category is empty right now. Try another category or search.</p>}
            actions={
              <Link href="/search" className={buttonClasses({ variant: "outline" })}>
                Search products
              </Link>
            }
          />
        }
      />
    </ListingTemplate>
  );
}
