import { describe, expect, it } from "vitest";
import { MAX_QUANTITY, clampQuantity, quantityLimits } from "./limits";

describe("quantityLimits", () => {
  it("is 1 to 99 without ERP limits", () => {
    expect(quantityLimits()).toEqual({ min: 1, max: MAX_QUANTITY, step: 1 });
  });

  it("uses the product's limits, with the size's own limits first", () => {
    expect(quantityLimits({ maxQuantity: 5 })).toEqual({ min: 1, max: 5, step: 1 });
    expect(quantityLimits({ maxQuantity: 5 }, { maxQuantity: 2 })).toEqual({
      min: 1,
      max: 2,
      step: 1,
    });
    expect(quantityLimits({ minQuantity: 10 })).toEqual({ min: 10, max: 99, step: 1 });
  });

  it("never goes above the storefront cap", () => {
    expect(quantityLimits({ maxQuantity: 500 }).max).toBe(MAX_QUANTITY);
  });

  it("keeps min and max on the step", () => {
    expect(quantityLimits({ quantityStep: 6 })).toEqual({ min: 6, max: 96, step: 6 });
    expect(quantityLimits({ quantityStep: 6, maxQuantity: 20 })).toEqual({
      min: 6,
      max: 18,
      step: 6,
    });
  });
});

describe("clampQuantity", () => {
  it("keeps quantities within the limits", () => {
    const limits = quantityLimits({ maxQuantity: 5 });
    expect(clampQuantity(3, limits)).toBe(3);
    expect(clampQuantity(8, limits)).toBe(5);
    expect(clampQuantity(0, limits)).toBe(1);
    expect(clampQuantity(Number.NaN, limits)).toBe(1);
  });

  it("rounds up to the step", () => {
    const limits = quantityLimits({ quantityStep: 6 });
    expect(clampQuantity(1, limits)).toBe(6);
    expect(clampQuantity(7, limits)).toBe(12);
    expect(clampQuantity(200, limits)).toBe(96);
  });
});
