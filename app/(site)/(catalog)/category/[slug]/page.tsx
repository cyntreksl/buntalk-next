import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingTemplate } from "@/components/layout/templates";
import { CategoryNav, ProductGrid } from "@/features/catalog";
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
  if (!category) return {};
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
      breadcrumb={[{ label: "Home", href: "/" }, { label: category.name }]}
      sidebarTitle="Categories"
      sidebar={<CategoryNav categories={categories} current={category.slug} />}
      toolbar={
        <p className="text-body-sm text-muted-foreground">
          {products.length} product{products.length === 1 ? "" : "s"}
        </p>
      }
    >
      <ProductGrid products={products} />
    </ListingTemplate>
  );
}
