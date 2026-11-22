import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingTemplate } from "@/components/layout/templates";
import { BagIcon, EmptyState, buttonClasses } from "@/components/ui";
import { Suspense } from "react";
import { CategoryNav, ProductGridSkeleton } from "@/features/catalog";
import { ProductFilters } from "@/features/catalog/ProductFilters";
import { ProductListing } from "@/features/catalog/ProductListing";
import { CategoryHeader } from "@/features/catalog/CategoryHeader";
import { SubcategoryLinks } from "@/features/catalog/SubcategoryLinks";
import { categoryChoices, categoryTrail } from "@/lib/categories";
import { getCategories, getCategory, getProductsByCategory } from "@/lib/erp";

// Category landing page (BUN-160, BUN-168): banner header with breadcrumb, sub-category
// links, sidebar tree and products (including sub-categories), all in ERP order.
// Static + ISR, "catalog" cache profile, refreshed by the ERP webhook — see README.

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

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/category/[slug]">) {
  const { slug } = await params;
  const [category, categories, products] = await Promise.all([
    getCategory(slug),
    getCategories(),
    getProductsByCategory(slug),
  ]);
  if (!category) notFound();

  // Filter by sub-category (BUN-173); each covers its own sub-categories too.
  const choices = categoryChoices(categories, category.slug);

  const breadcrumb = [
    { label: "Home", href: "/" },
    { label: "Categories", href: "/categories" },
    // Parent categories first, then this one (not a link: it is the current page).
    ...categoryTrail(categories, category.slug)
      .slice(0, -1)
      .map((c) => ({ label: c.name, href: `/category/${c.slug}` })),
    { label: category.name },
  ];

  return (
    <ListingTemplate
      title={category.name}
      header={
        <div className="flex flex-col gap-5">
          <CategoryHeader
            category={category}
            breadcrumb={breadcrumb}
            productCount={products.length}
          />
          <SubcategoryLinks categories={categories} current={category.slug} />
        </div>
      }
      sidebarTitle="Filters"
      sidebar={
        <>
          {/* Filters read the URL, so they stream in like the grid (BUN-173). */}
          <Suspense fallback={null}>
            <ProductFilters
              products={products}
              searchParams={searchParams}
              basePath={`/category/${category.slug}`}
              categoryChoices={choices}
            />
          </Suspense>
          <div className="border-border border-t pt-5">
            <CategoryNav categories={categories} current={category.slug} />
          </div>
        </>
      }
    >
      {/* Filters, sorting and paging read the URL, so the grid renders per request
          (streamed into the prerendered page; data comes from the cached ERP read). */}
      <Suspense fallback={<ProductGridSkeleton count={8} />}>
        <ProductListing
          products={products}
          searchParams={searchParams}
          basePath={`/category/${category.slug}`}
          categoryChoices={choices}
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
      </Suspense>
    </ListingTemplate>
  );
}
