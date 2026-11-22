import { describe, expect, it } from "vitest";
import { lineTotal, listingPrice, sumMoney, variantLabel } from "./pricing";

const size = (value: string, price: number, compareAtPrice?: number) => ({
  options: [{ type: "Size", value }],
  price,
  compareAtPrice,
});

describe("listingPrice", () => {
  it("uses the product price when there are no sizes", () => {
    expect(listingPrice({ price: 120 })).toEqual({ price: 120, from: false });
  });

  it('shows the lowest size price as "From" when sizes are priced differently', () => {
    const p = listingPrice({ price: 1, skus: [size("2 kg", 8500), size("1 kg", 4500, 5000)] });
    expect(p).toEqual({ price: 4500, compareAtPrice: 5000, from: true });
  });

  it('doesn\'t say "From" when every size has the same price', () => {
    expect(listingPrice({ price: 1, skus: [size("A", 300), size("B", 300)] }).from).toBe(false);
  });
});

describe("money helpers", () => {
  it("adds money in cents", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(lineTotal(8500.1, 3)).toBe(25500.3);
  });

  it("labels a variant by its option values", () => {
    expect(
      variantLabel([
        { type: "Size", value: "1 kg" },
        { type: "Flavour", value: "Chocolate" },
      ]),
    ).toBe("1 kg / Chocolate");
  });
});
