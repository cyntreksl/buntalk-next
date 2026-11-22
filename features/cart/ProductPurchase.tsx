"use client";

import { useState } from "react";
import { Button, QuantityStepper, Radio, RadioGroup } from "@/components/ui";
import { Price } from "@/features/catalog/Price";
import type { Product } from "@/lib/erp";
import { variantLabel } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import { useAddToCart } from "./useAddToCart";

type ProductPurchaseProps = {
  product: Pick<Product, "slug" | "name" | "price" | "compareAtPrice" | "currency" | "skus">;
};

/**
 * Price, size picker, quantity and "Add to cart" on the product page.
 *
 * Client island on a cached product page: every visitor gets the same HTML
 * with the ERP's online prices. Each size (SKU) shows its own ERP price.
 * Before adding, the server checks the product and size with the ERP and
 * returns the price to put in the cart (the signed-in customer's own price,
 * if they have one). Nothing here calculates a price.
 */
export function ProductPurchase({ product }: ProductPurchaseProps) {
  const { add: addToCart, adding } = useAddToCart();
  const skus = product.skus ?? [];
  const [skuId, setSkuId] = useState(() => (skus.find((s) => s.inStock) ?? skus[0])?.id);
  const [quantity, setQuantity] = useState(1);

  const sku = skus.find((s) => s.id === skuId);
  const shown = sku ?? product;
  const soldOut = sku ? !sku.inStock : false;

  async function add() {
    if (await addToCart({ productSlug: product.slug, skuId, quantity })) setQuantity(1);
  }

  return (
    <div className="flex flex-col gap-5">
      <Price
        price={shown.price}
        compareAtPrice={shown.compareAtPrice}
        currency={product.currency}
        size="lg"
      />

      {skus.length > 1 && (
        <RadioGroup legend="Choose a size">
          <div className="flex flex-col gap-2">
            {skus.map((s) => (
              <Radio
                key={s.id}
                name={`size-${product.slug}`}
                value={s.id}
                checked={s.id === skuId}
                onChange={() => setSkuId(s.id)}
                disabled={!s.inStock}
                label={
                  <span className="flex flex-wrap gap-x-2">
                    <span className="font-semibold">{variantLabel(s.options) || s.code}</span>
                    <span className="text-muted-foreground">
                      {s.inStock ? formatPrice(s.price, product.currency) : "Sold out"}
                    </span>
                  </span>
                }
              />
            ))}
          </div>
        </RadioGroup>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          label={`Quantity of ${product.name}`}
        />
        <Button onClick={add} loading={adding} disabled={soldOut}>
          {soldOut ? "Sold out" : "Add to cart"}
        </Button>
      </div>
    </div>
  );
}
