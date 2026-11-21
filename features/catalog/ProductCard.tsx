import Link from "next/link";
import type { Product } from "@/lib/erp";
import { formatPrice } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  return (
    <li className="border-border bg-surface rounded-lg border p-4 shadow-xs transition-shadow hover:shadow-md">
      {/* prefetch={true} loads the product's own page, not just the shared App Shell */}
      <Link href={`/product/${product.slug}`} prefetch={true} className="block">
        <h3 className="text-h4">{product.name}</h3>
        <p className="text-muted-foreground text-sm">
          {formatPrice(product.price, product.currency)}
        </p>
      </Link>
    </li>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="text-muted-foreground">No products found.</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </ul>
  );
}
