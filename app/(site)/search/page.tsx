import type { Metadata } from "next";
import { after, connection } from "next/server";
import { Suspense } from "react";
import { ListingTemplate } from "@/components/layout/templates";
import { Button, EmptyState, Input, SearchIcon } from "@/components/ui";
import { ProductGridSkeleton } from "@/features/catalog";
import { ProductListing } from "@/features/catalog/ProductListing";
import { CategorySuggestions } from "@/features/catalog/CategorySuggestions";
import { getDb } from "@/lib/db";
import { ProductFilters } from "@/features/catalog/ProductFilters";
import { categoryChoices } from "@/lib/categories";
import { getCategories, searchProducts } from "@/lib/erp";
import { recordSearchMiss } from "@/lib/search-misses";

// Search (BUN-172): listing template without a sidebar. Dynamic: the page frame
// is static; results depend on ?q= so they render per request. Results per query
// are cached briefly ("search" profile). Search is typo-tolerant and only finds
// products shown online (lib/search.ts).

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false },
};

async function readQuery(searchParams: PageProps<"/search">["searchParams"]) {
  const { q } = await searchParams;
  return typeof q === "string" ? q.trim() : "";
}

/** Filter sidebar for the results (BUN-173): top-level categories, price, offers, options. */
async function SearchFilters({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const query = await readQuery(searchParams);
  if (!query) return null;
  const [products, categories] = await Promise.all([searchProducts(query), getCategories()]);
  return (
    <ProductFilters
      products={products}
      searchParams={searchParams}
      basePath="/search"
      keep={[["q", query]]}
      categoryChoices={categoryChoices(categories)}
    />
  );
}

async function Results({ searchParams }: Pick<PageProps<"/search">, "searchParams">) {
  const query = await readQuery(searchParams);
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

  const [products, categories] = await Promise.all([searchProducts(query), getCategories()]);
  if (products.length === 0) {
    // Count it for the team (GET /api/search/misses), after the page is sent.
    // connection(): only for a real visit, never while prerendering.
    await connection();
    after(async () => {
      try {
        await recordSearchMiss(await getDb(), query);
      } catch (error) {
        console.error("[search] Could not record a no-result search.", error);
      }
    });
    return (
      <EmptyState
        icon={<SearchIcon size={32} />}
        title={<>No results for &ldquo;{query}&rdquo;</>}
        description={
          <div role="status" className="flex flex-col gap-1">
            <p>We couldn&apos;t find any products matching your search.</p>
            <p className="text-body-sm">
              Try a shorter or more general word, or browse our popular categories.
            </p>
          </div>
        }
      >
        <CategorySuggestions />
      </EmptyState>
    );
  }

  return (
    <section aria-label={`Results for ${query}`} className="flex flex-col gap-2">
      <h2 className="text-h3">Results for &ldquo;{query}&rdquo;</h2>
      <ProductListing
        products={products}
        searchParams={searchParams}
        basePath="/search"
        keep={[["q", query]]}
        categoryChoices={categoryChoices(categories)}
      />
    </section>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <ListingTemplate
      title="Search"
      sidebar={
        <Suspense fallback={null}>
          <SearchFilters searchParams={searchParams} />
        </Suspense>
      }
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
