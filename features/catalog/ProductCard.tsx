import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, ProductCardSkeleton } from "@/components/ui";
import type { Product } from "@/lib/erp";
import { listingPrice } from "@/lib/pricing";
import { cx } from "@/lib/utils";
import { OfferBadges } from "./OfferBadges";
import { Price, savingsLabel } from "./Price";
import { ProductImage } from "./ProductImage";

/**
 * Product card (marketplace style): photo in a soft rounded well with offer
 * badges, then a two-line name and the price. No border or shadow; the whole
 * card is one click target.
 */
export function ProductCard({ product, className }: { product: Product; className?: string }) {
  // Lowest size price ("From …") when sizes are priced differently. All prices are the ERP's.
  const shown = listingPrice(product);
  const savings = savingsLabel(shown);
  return (
    <li className={cx("group relative flex h-full flex-col gap-2", className)}>
      <div className="relative overflow-hidden rounded-xl">
        <div className="transition-transform duration-300 group-hover:scale-[1.03]">
          <ProductImage product={product} variant="card" />
        </div>
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {savings && <Badge tone="brand">{savings}</Badge>}
          {/* ERP scheme offers ("Buy 2 get 1 free"), hidden outside their dates. */}
          <OfferBadges offers={product.offers} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 px-0.5">
        <h3 className="text-body-sm text-foreground line-clamp-2 font-semibold tracking-normal">
          {/* prefetch={true} loads the product's own page, not just the shared App Shell.
              The link covers the whole card (after: pseudo-element) so the card is one click target. */}
          <Link
            href={`/product/${product.slug}`}
            prefetch={true}
            className="group-hover:text-primary after:absolute after:inset-0 after:rounded-xl"
          >
            {product.name}
          </Link>
        </h3>
        <Price
          price={shown.price}
          compareAtPrice={shown.compareAtPrice}
          from={shown.from}
          currency={product.currency}
          className="mt-auto"
        />
      </div>
    </li>
  );
}

const gridClasses = "grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4";

/**
 * A horizontal row of products (home page rows). Swipes sideways on phones
 * and tablets (scroll-snap, no JavaScript); five across on desktop.
 */
export function ProductRail({ products, className }: { products: Product[]; className?: string }) {
  if (products.length === 0) return null;
  return (
    <ul
      className={cx(
        "-mx-4 grid snap-x snap-mandatory auto-cols-[44%] grid-flow-col gap-x-3 overflow-x-auto px-4 pb-2 sm:auto-cols-[30%] md:-mx-6 md:px-6 lg:mx-0 lg:grid-flow-row lg:grid-cols-5 lg:gap-x-4 lg:overflow-visible lg:px-0",
        "[&>li]:snap-start",
        className,
      )}
    >
      {products.slice(0, 10).map((product, i) => (
        // Desktop shows one row of five; the rest are reachable on smaller screens by swiping.
        <ProductCard key={product.slug} product={product} className={cx(i >= 5 && "lg:hidden")} />
      ))}
    </ul>
  );
}

export function ProductGrid({
  products,
  className,
  empty,
}: {
  products: Product[];
  className?: string;
  /** Shown instead of the grid when there are no products. */
  empty?: ReactNode;
}) {
  if (products.length === 0) {
    return empty ?? <p className="text-muted-foreground">No products found.</p>;
  }
  return (
    <ul className={cx(gridClasses, className)}>
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </ul>
  );
}

/** Placeholder grid while products load. */
export function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" className={gridClasses}>
      <span className="sr-only">Loading products…</span>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
