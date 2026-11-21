import Link from "next/link";
import { ProductGrid } from "@/features/catalog";
import { getCategories, getFeaturedProducts } from "@/lib/erp";

// Home: static + ISR, "catalog" cache profile (refreshes every 15 min) — see README.
export default async function HomePage() {
  const [categories, featured] = await Promise.all([getCategories(), getFeaturedProducts()]);

  return (
    <main className="max-w-page mx-auto flex w-full flex-1 flex-col gap-10 px-4 py-10 md:px-6 md:py-16">
      <h1 className="text-h1">Buntalk</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-h3">Categories</h2>
        <ul className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/category/${category.slug}`}
                prefetch={true}
                className="border-accent bg-accent-soft text-accent-soft-foreground hover:bg-accent hover:text-accent-foreground rounded-full border px-4 py-1.5 font-semibold"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-h3">Featured</h2>
        <ProductGrid products={featured} />
      </section>
    </main>
  );
}
