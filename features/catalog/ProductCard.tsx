import Link from "next/link";
import type { Product } from "@/lib/erp";
import { formatPrice } from "@/lib/utils";

export function ProductCard({ product }: { product: Product }) {
  return (
    <li className="border-foreground/10 rounded-lg border p-4">
      {/* prefetch={true} loads the product's own page, not just the shared App Shell */}
      <Link href={`/product/${product.slug}`} prefetch={true} className="block">
        <h3 className="font-medium">{product.name}</h3>
        <p className="text-foreground/70 text-sm">{formatPrice(product.price, product.currency)}</p>
      </Link>
    </li>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return <p className="text-foreground/70">No products found.</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </ul>
  );
}
