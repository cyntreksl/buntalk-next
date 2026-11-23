import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/erp";

const products: Partial<Product>[] = [
  { slug: "fish-bun", customizable: false, skus: [{ id: "sku-1kg" } as never] },
  { slug: "design-your-own-cake", customizable: true, skus: [{ id: "sku-1kg" } as never] },
  { slug: "birthday-studio-cake", customizable: true, skus: [{ id: "sku-1kg" } as never] },
];
vi.mock("@/lib/erp", () => ({ getAllProducts: async () => products }));
const { cakeLineFor, cakePreview, cakeSummary } = await import("./cart.server");

const menu = { sizes: [{ id: 4, skuLinkId: "sku-1kg" }, { id: 5 }] } as never;

describe("Cake Studio cart lines (BUN-184)", () => {
  it("adds a design as the Cake Studio product size its cake size is sold as", async () => {
    expect(await cakeLineFor(menu, 4)).toEqual({
      productSlug: "design-your-own-cake",
      skuId: "sku-1kg",
    });
    // Opened from a product: that product, when it sells the size.
    expect(await cakeLineFor(menu, 4, "birthday-studio-cake")).toMatchObject({
      productSlug: "birthday-studio-cake",
    });
    expect(await cakeLineFor(menu, 4, "fish-bun")).toMatchObject({
      productSlug: "design-your-own-cake",
    });
    // A cake size not linked to a product size can't be added.
    expect(await cakeLineFor(menu, 5)).toBeNull();
  });

  it("shows the ERP's summary as short lines, and only pictures the cart can load", () => {
    const summary = cakeSummary({
      summary: [
        { label: "Size", value: "1 kg round" },
        { label: "Message", value: "x".repeat(100) },
      ],
    });
    expect(summary[0]).toBe("Size: 1 kg round");
    expect(summary[1]).toHaveLength(80);
    expect(cakePreview({ previewUrl: "https://img.test/a.png" })).toBe("https://img.test/a.png");
    expect(cakePreview({ previewUrl: "http://127.0.0.1:4010/a.png" })).toBeDefined();
    expect(cakePreview({ previewUrl: "http://evil.test/a.png" })).toBeUndefined();
    expect(cakePreview({ previewUrl: "//evil.test/a.png" })).toBeUndefined();
  });
});
