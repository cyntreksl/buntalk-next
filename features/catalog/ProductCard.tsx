import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Card, CardTitle, ProductCardSkeleton } from "@/components/ui";
import type { Product } from "@/lib/erp";
import { listingPrice } from "@/lib/pricing";
import { cx } from "@/lib/utils";
import { OfferBadges } from "./OfferBadges";
import { Price, savingsLabel } from "./Price";
import { ProductImage } from "./ProductImage";

export function ProductCard({ product }: { product: Product }) {
  // Lowest size price ("From …") when sizes are priced differently. All prices are the ERP's.
  const shown = listingPrice(product);
  const savings = savingsLabel(shown);
  return (
    <li>
      <Card interactive padding="none" className="relative flex h-full flex-col overflow-hidden">
        <div className="relative">
          <ProductImage product={product} variant="card" />
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {savings && <Badge tone="brand">{savings}</Badge>}
            {/* ERP scheme offers ("Buy 2 get 1 free"), hidden outside their dates. */}
            <OfferBadges offers={product.offers} />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1 p-4">
          <CardTitle className="text-body-lg">
            {/* prefetch={true} loads the product's own page, not just the shared App Shell.
                The link covers the whole card (after: pseudo-element) so the card is one click target. */}
            <Link
              href={`/product/${product.slug}`}
              prefetch={true}
              className="after:absolute after:inset-0 after:rounded-lg"
            >
              {product.name}
            </Link>
          </CardTitle>
          <Price
            price={shown.price}
            compareAtPrice={shown.compareAtPrice}
            from={shown.from}
            currency={product.currency}
            className="mt-auto pt-1"
          />
        </div>
      </Card>
    </li>
  );
}

const gridClasses = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4";

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
