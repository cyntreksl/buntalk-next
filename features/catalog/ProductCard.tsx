import Link from "next/link";
import { Card, CardTitle, ProductCardSkeleton } from "@/components/ui";
import type { Product } from "@/lib/erp";
import { formatPrice } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  return (
    <li>
      <Card interactive className="relative h-full">
        <CardTitle>
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
        <p className="text-body-sm text-primary mt-1 font-bold">
          {formatPrice(product.price, product.currency)}
        </p>
      </Card>
    </li>
  );
}

const gridClasses = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3";

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="text-muted-foreground">No products found.</p>;
  }
  return (
    <ul className={gridClasses}>
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </ul>
  );
}

/** Placeholder grid while products load. */
export function ProductGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div role="status" className={gridClasses}>
      <span className="sr-only">Loading products…</span>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
