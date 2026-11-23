import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/lib/erp";

/**
 * BUN-177: cart totals come from the ERP (prices and scheme engine), never
 * from the browser. These tests send a tampered cart through the real route.
 */
const getProductsForCart = vi.fn();
const quoteCart = vi.fn();
vi.mock("@/lib/auth", () => ({ getCustomerId: async () => null }));
vi.mock("@/lib/erp", () => ({
  ErpError: class ErpError extends Error {},
  ErpResponseError: class ErpResponseError extends Error {},
  getProductsForCart: (...args: unknown[]) => getProductsForCart(...args),
  quoteCart: (...args: unknown[]) => quoteCart(...args),
}));

const { POST } = await import("./route");

const bun: Product = {
  id: "p-bun",
  slug: "fish-bun",
  name: "Fish bun",
  description: "",
  price: 120,
  currency: "LKR",
  categorySlug: "buns",
  featured: false,
  skus: [],
};

// What the ERP's scheme engine says for 3 fish buns: buy 2 get 1 free.
const erpQuote = {
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
  ],
  appliedSchemes: [{ schemeId: "s-multibuy", name: "Bun bonanza", discount: 120 }],
  freeItems: [{ name: "Fish bun", quantity: 1, schemeId: "s-multibuy" }],
  subtotal: 360,
  discountTotal: 120,
  total: 240,
};

const call = (body: unknown) =>
  POST(
    new Request("http://x/api/cart/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  getProductsForCart.mockReset().mockResolvedValue(new Map([["fish-bun", bun]]));
  quoteCart.mockReset().mockResolvedValue(erpQuote);
});

describe("POST /api/cart/validate", () => {
  it("ignores every price, discount and total the browser sends", async () => {
    const res = await call({
      items: [
        {
          productSlug: "fish-bun",
          quantity: 3,
          unitPrice: 1,
          lineTotal: 1,
          discount: 999,
          schemes: [{ id: "fake", name: "Fake 100% off" }],
        },
      ],
      subtotal: 1,
      discountTotal: 999,
      total: 0,
    });
    const cart = await res.json();
    expect(res.status).toBe(200);
    // Only the product, size and quantity reach the ERP.
    expect(quoteCart).toHaveBeenCalledWith(
      [{ productId: "p-bun", skuId: undefined, quantity: 3 }],
      {
        customerId: undefined,
      },
    );
    expect(cart.items[0]).toMatchObject({
      unitPrice: 120,
      lineSubtotal: 360,
      discount: 120,
      lineTotal: 240,
      schemes: [{ id: "s-multibuy", name: "Bun bonanza" }],
    });
  });

  it("returns exactly the ERP's totals, offers and free items", async () => {
    const cart = await (await call({ items: [{ productSlug: "fish-bun", quantity: 3 }] })).json();
    expect([cart.subtotal, cart.discountTotal, cart.total]).toEqual([360, 120, 240]);
    expect(cart.appliedSchemes).toEqual([{ id: "s-multibuy", name: "Bun bonanza", discount: 120 }]);
    expect(cart.freeItems).toEqual([{ name: "Fish bun", quantity: 1, schemeName: "Bun bonanza" }]);
  });

  it("refuses a body that isn't a cart", async () => {
    expect((await call({ items: [{ productSlug: "fish-bun", quantity: -1 }] })).status).toBe(400);
    expect((await call({ nope: true })).status).toBe(400);
  });
});
