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
  if (!query.trim()) return <p className="text-foreground/70">Type something to search.</p>;

  const products = await searchProducts(query);
  return (
    <section className="flex flex-col gap-4">
      <p className="text-foreground/70">
        {products.length} result{products.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
      </p>
      <ProductGrid products={products} />
    </section>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
      <form action="/search" className="flex gap-2">
        <input
          name="q"
          type="search"
          placeholder="Search products"
          className="border-foreground/20 flex-1 rounded-md border bg-transparent px-3 py-2"
        />
        <button type="submit" className="bg-foreground text-background rounded-md px-4 py-2">
          Search
        </button>
      </form>
      <Suspense fallback={<p className="text-foreground/70">Searching…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
