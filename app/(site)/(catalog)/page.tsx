import Link from "next/link";
import { FullWidthSection, FullWidthTemplate } from "@/components/layout/templates";
import { buttonClasses } from "@/components/ui";
import { ProductGrid } from "@/features/catalog";
import { brand } from "@/lib/brand";
import { getCategories, getFeaturedProducts } from "@/lib/erp";

// Home: full-width template. Static + ISR, "catalog" cache profile (refreshes every 15 min) — see README.
// The full home page design is BUN-157; this sets up its structure.
export default async function HomePage() {
  const [categories, featured] = await Promise.all([getCategories(), getFeaturedProducts()]);

  return (
    <FullWidthTemplate>
      <FullWidthSection tone="brand" spacing="lg" aria-labelledby="home-title">
        <div className="flex max-w-prose flex-col gap-4">
          <h1 id="home-title" className="text-display">
            {brand.name}
          </h1>
          <p lang="si" className="font-sinhala text-h3 text-heading">
            {brand.tagline}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="#categories" className={buttonClasses({ size: "lg" })}>
              Shop by category
            </Link>
            <Link href="/search" className={buttonClasses({ size: "lg", variant: "outline" })}>
              Search
            </Link>
          </div>
        </div>
      </FullWidthSection>

      <FullWidthSection aria-labelledby="categories">
        <div className="flex flex-col gap-4">
          <h2 id="categories" className="text-h2 scroll-mt-6">
            Categories
          </h2>
          <ul className="flex flex-wrap gap-3">
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
        </div>
      </FullWidthSection>

      <FullWidthSection tone="muted" aria-labelledby="featured">
        <div className="flex flex-col gap-4">
          <h2 id="featured" className="text-h2">
            Featured
          </h2>
          <ProductGrid products={featured} />
        </div>
      </FullWidthSection>
    </FullWidthTemplate>
  );
}
