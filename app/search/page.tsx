import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductGrid } from "@/features/catalog";
import { searchProducts } from "@/lib/erp";

// Search: dynamic. The page frame is static; results depend on ?q= so they
// render per request. Results per query are cached briefly ("search" profile).

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  if (!query.trim()) return <p className="text-muted-foreground">Type something to search.</p>;

  const products = await searchProducts(query);
  return (
    <section className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        {products.length} result{products.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
      </p>
      <ProductGrid products={products} />
    </section>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="max-w-page mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-10 md:px-6 md:py-16">
      <h1 className="text-h1">Search</h1>
      <form action="/search" className="flex gap-2">
        <input
          name="q"
          type="search"
          placeholder="Search products"
          className="border-border-strong bg-surface flex-1 rounded-sm border px-3 py-2"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-5 py-2 font-bold"
        >
          Search
        </button>
      </form>
      <Suspense fallback={<p className="text-muted-foreground">Searching…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
