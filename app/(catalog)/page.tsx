import Link from "next/link";
import { ProductGrid } from "@/features/catalog";
import { getCategories, getFeaturedProducts } from "@/lib/erp";

// Home: static + ISR, "catalog" cache profile (refreshes every 15 min) — see README.
export default async function HomePage() {
  const [categories, featured] = await Promise.all([getCategories(), getFeaturedProducts()]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Buntalk</h1>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-medium">Categories</h2>
        <ul className="flex flex-wrap gap-3">
          {categories.map((category) => (
            <li key={category.slug}>
              <Link
                href={`/category/${category.slug}`}
                prefetch={true}
                className="border-foreground/15 rounded-full border px-4 py-1.5"
              >
                {category.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-medium">Featured</h2>
        <ProductGrid products={featured} />
      </section>
    </main>
  );
}
