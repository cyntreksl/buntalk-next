"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, QuantityStepper, Radio, RadioGroup, buttonClasses } from "@/components/ui";
import { Price } from "@/features/catalog/Price";
import { useSelectedSku } from "@/features/product/SelectedSku";
import type { Product } from "@/lib/erp";
import { defaultSkuId, variantLabel } from "@/lib/pricing";
import { formatPrice, formatWeight } from "@/lib/utils";
import { useAddToCart } from "./useAddToCart";

type ProductPurchaseProps = {
  product: Pick<
    Product,
    | "slug"
    | "name"
    | "price"
    | "compareAtPrice"
    | "currency"
    | "skus"
    | "customizable"
    | "netWeightGrams"
    | "servings"
  >;
};

/**
 * Price, size picker, quantity and "Add to cart" on the product page.
 *
 * Client island on a cached product page: every visitor gets the same HTML
 * with the ERP's online prices. Each size (SKU) shows its own ERP price, and
 * picking one updates the price, weight, servings and (through
 * SelectedSkuProvider) the photo. Before adding, the server checks the
 * product and size with the ERP, so a hidden, removed or sold-out product
 * can't be added (BUN-161, BUN-171). Nothing here calculates a price.
 *
 * Cake Studio products (ERP is_customisable) show "Customize in Cake Studio"
 * instead: they're designed there before they go in the cart.
 */
export function ProductPurchase({ product }: ProductPurchaseProps) {
  const { add: addToCart, adding } = useAddToCart();
  const skus = product.skus ?? [];
  const { skuId, setSkuId } = useSelectedSku(defaultSkuId(skus));
  const [quantity, setQuantity] = useState(1);

  const sku = skus.find((s) => s.id === skuId);
  const shown = sku ?? product;
  const soldOut = sku ? !sku.inStock : false;
  const weight = sku?.netWeightGrams ?? product.netWeightGrams;
  const servings = sku?.servings ?? product.servings;
  const facts = [weight && formatWeight(weight), servings && `Serves ${servings}`].filter(Boolean);

  async function add() {
    if (await addToCart({ productSlug: product.slug, skuId, quantity })) setQuantity(1);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Price
          price={shown.price}
          compareAtPrice={shown.compareAtPrice}
          currency={product.currency}
          size="lg"
        />
        {facts.length > 0 && (
          <p className="text-body-sm text-muted-foreground font-semibold">{facts.join(" · ")}</p>
        )}
      </div>

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

      {product.customizable ? (
        <div className="flex flex-col gap-2">
          <Link
            href={`/cake-studio?product=${encodeURIComponent(product.slug)}`}
            className={buttonClasses({ size: "lg" })}
          >
            Customize in Cake Studio
          </Link>
          <p className="text-body-sm text-muted-foreground">
            Choose the size, flavour, decorations and message, then add it to your cart.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <QuantityStepper
            value={quantity}
            onChange={setQuantity}
            label={`Quantity of ${product.name}`}
            disabled={soldOut}
          />
          <Button onClick={add} loading={adding} disabled={soldOut}>
            {soldOut ? "Sold out" : "Add to cart"}
          </Button>
        </div>
      )}
    </div>
  );
}
