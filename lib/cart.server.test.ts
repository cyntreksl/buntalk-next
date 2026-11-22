import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/erp";

const getProductsForCart = vi.fn();
vi.mock("@/lib/erp", () => ({
  ErpError: class ErpError extends Error {},
  getProductsForCart: (...args: unknown[]) => getProductsForCart(...args),
}));

const { priceCart } = await import("./cart.server");

const bun: Product = {
  slug: "fish-bun",
  name: "Fish bun",
  description: "",
  price: 120,
  currency: "LKR",
  categorySlug: "buns",
  featured: false,
  skus: [],
};

const cake: Product = {
  ...bun,
  slug: "cake",
  name: "Cake",
  price: 4500,
  skus: [
    {
      id: "s1",
      code: "1KG",
      options: [{ type: "Size", value: "1 kg" }],
      price: 4500,
      inStock: true,
    },
    {
      id: "s2",
      code: "2KG",
      options: [{ type: "Size", value: "2 kg" }],
      price: 8500.1,
      inStock: true,
    },
    {
      id: "s3",
      code: "3KG",
      options: [{ type: "Size", value: "3 kg" }],
      price: 12000,
      inStock: false,
    },
  ],
};

beforeEach(() => {
  getProductsForCart.mockReset();
  getProductsForCart.mockResolvedValue(
    new Map<string, Product | null>([
      ["fish-bun", bun],
      ["cake", cake],
      ["hidden", null],
    ]),
  );
});

describe("priceCart", () => {
  it("uses the ERP price, never one sent by the browser", async () => {
    const cart = await priceCart([{ productSlug: "fish-bun", quantity: 3, unitPrice: 1 } as never]);
    expect(cart.items[0]).toMatchObject({ unitPrice: 120, quantity: 3, lineTotal: 360 });
    expect(cart.subtotal).toBe(360);
  });

  it("prices each size with its own ERP price and labels it", async () => {
    const cart = await priceCart([
      { productSlug: "cake", skuId: "s1", quantity: 1 },
      { productSlug: "cake", skuId: "s2", quantity: 3 },
    ]);
    expect(cart.items.map((i) => [i.key, i.variant, i.unitPrice, i.lineTotal])).toEqual([
      ["cake:s1", "1 kg", 4500, 4500],
      ["cake:s2", "2 kg", 8500.1, 25500.3],
    ]);
    // Added in cents: no floating-point dust.
    expect(cart.subtotal).toBe(30000.3);
  });

  it("drops hidden products, sold-out sizes, unknown sizes and lines missing a size", async () => {
    const cart = await priceCart([
      { productSlug: "hidden", quantity: 1 },
      { productSlug: "cake", skuId: "s3", quantity: 1 },
      { productSlug: "cake", skuId: "gone", quantity: 1 },
      { productSlug: "cake", quantity: 1 },
      { productSlug: "fish-bun", quantity: 1 },
    ]);
    expect(cart.removed).toEqual([
      { key: "hidden", reason: "not_available" },
      { key: "cake:s3", reason: "sold_out" },
      { key: "cake:gone", reason: "not_available" },
      { key: "cake", reason: "choose_variant" },
    ]);
    expect(cart.items.map((i) => i.key)).toEqual(["fish-bun"]);
    expect(cart.subtotal).toBe(120);
  });

  it("asks the ERP for the signed-in customer's own prices", async () => {
    await priceCart([{ productSlug: "fish-bun", quantity: 1 }], { customerId: "cust-1" });
    expect(getProductsForCart).toHaveBeenCalledWith(["fish-bun"], { customerId: "cust-1" });

    await priceCart([{ productSlug: "fish-bun", quantity: 1 }], { customerId: null });
    expect(getProductsForCart).toHaveBeenLastCalledWith(["fish-bun"], { customerId: undefined });
  });
});
