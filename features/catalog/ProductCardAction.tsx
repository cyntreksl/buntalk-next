"use client";

import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui";
import { useAddToCart } from "@/features/cart/useAddToCart";
import type { Product } from "@/lib/erp";
import { cx } from "@/lib/utils";

/**
 * The button at the bottom of a product card (BUN-170):
 * - Cake Studio product (ERP is_customisable): "Customize", opens Cake Studio.
 * - Several sizes: "Choose size", opens the product page.
 * - Every size sold out: a disabled "Sold out".
 * - Otherwise: quick "Add to cart" (checked with the ERP, like the product page).
 *
 * It sits above the card's full-size link (relative z-10), so it gets its own clicks.
 */
export function ProductCardAction({
  product,
}: {
  product: Pick<Product, "slug" | "name" | "skus" | "customizable">;
}) {
  const { add, adding } = useAddToCart();
  const skus = product.skus ?? [];
  const base = "relative z-10";
  const linkClasses = buttonClasses({ variant: "outline", size: "sm", fullWidth: true });

  if (product.customizable) {
    return (
      <Link
        href={`/cake-studio/${encodeURIComponent(product.slug)}`}
        className={cx(base, linkClasses)}
        aria-label={`Customize ${product.name}`}
      >
        Customize
      </Link>
    );
  }
  if (skus.length > 0 && skus.every((s) => !s.inStock)) {
    return (
      <Button size="sm" variant="outline" fullWidth disabled className={base}>
        Sold out
      </Button>
    );
  }
  if (skus.length > 1) {
    return (
      <Link
        href={`/product/${product.slug}`}
        className={cx(base, linkClasses)}
        aria-label={`Choose a size for ${product.name}`}
      >
        Choose size
      </Link>
    );
  }
  return (
    <Button
      size="sm"
      fullWidth
      loading={adding}
      className={base}
      aria-label={`Add ${product.name} to cart`}
      onClick={() => add({ productSlug: product.slug, skuId: skus[0]?.id, quantity: 1 })}
    >
      Add to cart
    </Button>
  );
}
