import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingTemplate } from "@/components/layout/templates";
import { Button, Input } from "@/components/ui";
import { ProductGrid, ProductGridSkeleton } from "@/features/catalog";
import { searchProducts } from "@/lib/erp";

// Search: listing template without a sidebar. Dynamic: the page frame is static;
// results depend on ?q= so they render per request. Results per query are cached
// briefly ("search" profile).

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
      <p className="text-muted-foreground" role="status">
        {products.length} result{products.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
      </p>
      <ProductGrid products={products} />
    </section>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <ListingTemplate
      title="Search"
      toolbar={
        <form action="/search" role="search" className="flex w-full gap-2">
          <label htmlFor="search-q" className="sr-only">
            Search products
          </label>
          <Input id="search-q" name="q" type="search" placeholder="Search products" />
          <Button type="submit">Search</Button>
        </form>
      }
    >
      <Suspense fallback={<ProductGridSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </ListingTemplate>
  );
}
