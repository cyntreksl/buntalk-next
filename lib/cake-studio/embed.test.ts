import { describe, expect, it } from "vitest";
import { sizeForProduct } from "./embed.server";

const menu = {
  sizes: [
    { id: 4, skuLinkId: "sku-studio-1kg" },
    { id: 5, skuLinkId: "sku-studio-2kg" },
    { id: 6 },
  ],
} as never;
const product = { skus: [{ id: "sku-studio-2kg" }, { id: "sku-studio-1kg" }] } as never;

describe("sizeForProduct", () => {
  it("picks the cake size linked to the chosen size, else to any of the product's sizes", () => {
    expect(sizeForProduct(menu, product, "sku-studio-1kg")).toBe(4);
    expect(sizeForProduct(menu, product)).toBe(5);
  });

  it("has no size when nothing is linked, or no menu", () => {
    expect(sizeForProduct(menu, { skus: [{ id: "other" }] } as never)).toBeUndefined();
    expect(sizeForProduct(null, product)).toBeUndefined();
  });
});
