import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingTemplate } from "@/components/layout/templates";
import { Button, EmptyState, Input, SearchIcon } from "@/components/ui";
import { ProductGrid, ProductGridSkeleton } from "@/features/catalog";
import { CategorySuggestions } from "@/features/catalog/CategorySuggestions";
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
  const query = typeof q === "string" ? q.trim() : "";
  if (!query) {
    return (
      <EmptyState
        icon={<SearchIcon size={32} />}
        title="What are you looking for?"
        description={<p>Type a product name in the search box above, or browse by category.</p>}
      >
        <CategorySuggestions />
      </EmptyState>
    );
  }

  const products = await searchProducts(query);
  if (products.length === 0) {
    return (
      <EmptyState
        icon={<SearchIcon size={32} />}
        title={<>No results for &ldquo;{query}&rdquo;</>}
        description={
          <div role="status" className="flex flex-col gap-1">
            <p>We couldn&apos;t find any products matching your search.</p>
            <p className="text-body-sm">Check the spelling, try a shorter word, or browse below.</p>
          </div>
        }
      >
        <CategorySuggestions />
      </EmptyState>
    );
  }

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
