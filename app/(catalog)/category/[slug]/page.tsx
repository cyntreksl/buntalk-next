import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGrid } from "@/features/catalog";
import { getCategories, getCategory, getProductsByCategory } from "@/lib/erp";

// Category: static + ISR, "catalog" cache profile (refreshes every 15 min) — see README.

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
  const [category, products] = await Promise.all([getCategory(slug), getProductsByCategory(slug)]);
  if (!category) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-16">
      <Link href="/" className="text-sm underline">
        &larr; Home
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{category.name}</h1>
        <p className="text-foreground/70">{category.description}</p>
      </header>
      <ProductGrid products={products} />
    </main>
  );
}
