import { beforeEach, describe, expect, it, vi } from "vitest";

const customerId = vi.fn<() => Promise<string | null>>();
const productsForCart = vi.fn();
vi.mock("@/lib/auth", () => ({ getCustomerId: () => customerId() }));
vi.mock("@/lib/erp", () => ({
  getProductsForCart: (...args: unknown[]) => productsForCart(...args),
}));

const { GET } = await import("./route");
const call = async (query: string) =>
  (await GET(new Request(`http://x/api/prices${query}`))).json();

beforeEach(() => {
  customerId.mockReset();
  productsForCart.mockReset();
});

describe("GET /api/prices", () => {
  it("returns nothing personal, and doesn't ask the ERP, for a visitor who isn't signed in", async () => {
    customerId.mockResolvedValue(null);
    expect(await call("?slugs=fish-bun")).toEqual({ personal: false, prices: {} });
    expect(productsForCart).not.toHaveBeenCalled();
  });

  it("returns the customer's own prices, per product and size, without hidden products", async () => {
    customerId.mockResolvedValue("cust-wholesale");
    productsForCart.mockResolvedValue(
      new Map([
        ["fish-bun", { price: 100, skus: [] }],
        ["cake", { price: 4000, skus: [{ id: "sku-1kg", price: 4000 }] }],
        ["hidden", null],
      ]),
    );
    expect(await call("?slugs=fish-bun,cake,hidden,Bad%20Slug")).toEqual({
      personal: true,
      prices: {
        "fish-bun": { price: 100, skus: {} },
        cake: { price: 4000, skus: { "sku-1kg": 4000 } },
      },
    });
    expect(productsForCart).toHaveBeenCalledWith(["fish-bun", "cake", "hidden"], {
      customerId: "cust-wholesale",
    });
  });

  it("falls back to the normal prices when the ERP fails", async () => {
    customerId.mockResolvedValue("cust-1");
    productsForCart.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await call("?slugs=fish-bun")).toEqual({ personal: false, prices: {} });
  });
});
