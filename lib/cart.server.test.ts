import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/erp";

const getProductsForCart = vi.fn();
const quoteCart = vi.fn();
vi.mock("@/lib/erp", () => ({
  ErpError: class ErpError extends Error {},
  ErpResponseError: class ErpResponseError extends Error {},
  getProductsForCart: (...args: unknown[]) => getProductsForCart(...args),
  quoteCart: (...args: unknown[]) => quoteCart(...args),
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
  quoteCart.mockReset();
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

describe("priceCart with the ERP scheme engine", () => {
  const erpBun: Product = { ...bun, id: "p-bun" };
  const erpCake: Product = { ...cake, id: "p-cake" };

  beforeEach(() => {
    getProductsForCart.mockResolvedValue(
      new Map<string, Product | null>([
        ["fish-bun", erpBun],
        ["cake", erpCake],
      ]),
    );
    quoteCart.mockResolvedValue({
      currency: "LKR",
      lines: [
        {
          productId: "p-bun",
          quantity: 3,
          unitPrice: 120,
          discount: 120,
          lineTotal: 240,
          schemeIds: ["s-multibuy"],
        },
        {
          productId: "p-cake",
          skuId: "s1",
          quantity: 1,
          unitPrice: 4500,
          discount: 450,
          lineTotal: 4050,
          schemeIds: ["s-cake-week"],
        },
      ],
      appliedSchemes: [
        { schemeId: "s-multibuy", name: "Bun bonanza", discount: 120 },
        { schemeId: "s-cake-week", name: "Cake week", discount: 450 },
      ],
      freeItems: [],
      subtotal: 4860,
      discountTotal: 570,
      total: 4290,
    });
  });

  it("sends only ERP ids and quantities, and shows which scheme gave which discount", async () => {
    const cart = await priceCart(
      [
        { productSlug: "fish-bun", quantity: 3 },
        { productSlug: "cake", skuId: "s1", quantity: 1 },
      ],
      { customerId: "cust-1" },
    );
    expect(quoteCart).toHaveBeenCalledWith(
      [
        { productId: "p-bun", skuId: undefined, quantity: 3 },
        { productId: "p-cake", skuId: "s1", quantity: 1 },
      ],
      { customerId: "cust-1" },
    );
    expect(
      cart.items.map((i) => [i.key, i.lineSubtotal, i.discount, i.lineTotal, i.schemes]),
    ).toEqual([
      ["fish-bun", 360, 120, 240, [{ id: "s-multibuy", name: "Bun bonanza" }]],
      ["cake:s1", 4500, 450, 4050, [{ id: "s-cake-week", name: "Cake week" }]],
    ]);
    expect(cart.appliedSchemes.map((s) => [s.name, s.discount])).toEqual([
      ["Bun bonanza", 120],
      ["Cake week", 450],
    ]);
    expect([cart.subtotal, cart.discountTotal, cart.total]).toEqual([4860, 570, 4290]);
  });

  it("doesn't ask the scheme engine about lines that were removed", async () => {
    getProductsForCart.mockResolvedValue(
      new Map<string, Product | null>([
        ["fish-bun", erpBun],
        ["gone", null],
      ]),
    );
    quoteCart.mockResolvedValue({
      currency: "LKR",
      lines: [
        {
          productId: "p-bun",
          quantity: 1,
          unitPrice: 120,
          discount: 0,
          lineTotal: 120,
          schemeIds: [],
        },
      ],
      appliedSchemes: [],
      freeItems: [],
      subtotal: 120,
      discountTotal: 0,
      total: 120,
    });
    const cart = await priceCart([
      { productSlug: "gone", quantity: 1 },
      { productSlug: "fish-bun", quantity: 1 },
    ]);
    expect(quoteCart.mock.calls[0][0]).toEqual([
      { productId: "p-bun", skuId: undefined, quantity: 1 },
    ]);
    expect(cart.total).toBe(120);
    expect(cart.removed).toEqual([{ key: "gone", reason: "not_available" }]);
  });

  it("refuses a quote that doesn't match the cart", async () => {
    quoteCart.mockResolvedValue({
      currency: "LKR",
      lines: [],
      appliedSchemes: [],
      freeItems: [],
      subtotal: 0,
      discountTotal: 0,
      total: 0,
    });
    await expect(priceCart([{ productSlug: "fish-bun", quantity: 1 }])).rejects.toThrow();
  });
});
