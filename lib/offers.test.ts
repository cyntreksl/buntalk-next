import { describe, expect, it } from "vitest";
import type { Scheme } from "@/lib/erp";
import { isWithinWindow, offersFor, schemeLabel, withSchemeBackedDiscounts } from "./offers";

const scheme = (x: Partial<Scheme>): Scheme => ({
  id: "s",
  name: "Offer",
  kind: "percent",
  productIds: [],
  categoryIds: [],
  wholeOrder: false,
  ...x,
});

describe("schemeLabel", () => {
  it("words each kind of scheme for a badge", () => {
    expect(schemeLabel(scheme({ kind: "percent", rewardValue: 10 }))).toBe("10% off");
    expect(schemeLabel(scheme({ kind: "percent", rewardValue: 12.5 }))).toBe("12.5% off");
    expect(schemeLabel(scheme({ kind: "amount", rewardValue: 200 })).replace(/\s/g, " ")).toBe(
      "LKR 200 off",
    );
    expect(schemeLabel(scheme({ kind: "buy_x_get_y", buyQuantity: 2, getQuantity: 1 }))).toBe(
      "Buy 2 get 1 free",
    );
    expect(schemeLabel(scheme({ kind: "free_item" }))).toBe("Free gift");
  });
});

describe("isWithinWindow", () => {
  const now = Date.parse("2026-11-22T10:00:00Z");
  it("is true inside the window and for open ends", () => {
    expect(isWithinWindow({}, now)).toBe(true);
    expect(isWithinWindow({ startsAt: "2026-11-21T00:00:00Z" }, now)).toBe(true);
    expect(isWithinWindow({ endsAt: "2026-11-23T00:00:00Z" }, now)).toBe(true);
  });
  it("is false before the start and from the end", () => {
    expect(isWithinWindow({ startsAt: "2026-11-23T00:00:00Z" }, now)).toBe(false);
    expect(isWithinWindow({ endsAt: "2026-11-22T10:00:00Z" }, now)).toBe(false);
  });
});

describe("offersFor", () => {
  const categories = [{ id: "cakes" }, { id: "birthday", parentId: "cakes" }, { id: "buns" }];
  const schemes = [
    scheme({
      id: "on-product",
      productIds: ["p1"],
      kind: "buy_x_get_y",
      buyQuantity: 2,
      getQuantity: 1,
    }),
    scheme({ id: "on-parent-category", categoryIds: ["cakes"], rewardValue: 10 }),
    scheme({ id: "other-category", categoryIds: ["buns"], rewardValue: 5 }),
    scheme({ id: "whole-order", wholeOrder: true, kind: "amount", rewardValue: 500 }),
  ];

  it("finds schemes on the product and on its category or any parent category", () => {
    const offers = offersFor(
      { id: "p1", categoryId: "birthday", currency: "LKR" },
      schemes,
      categories,
    );
    expect(offers.map((o) => [o.schemeId, o.label])).toEqual([
      ["on-product", "Buy 2 get 1 free"],
      ["on-parent-category", "10% off"],
    ]);
  });

  it("never shows whole-order schemes as a product offer", () => {
    const offers = offersFor(
      { id: "p2", categoryId: "buns", currency: "LKR" },
      schemes,
      categories,
    );
    expect(offers.map((o) => o.schemeId)).toEqual(["other-category"]);
  });
});

describe("withSchemeBackedDiscounts", () => {
  const now = Date.parse("2026-11-22T10:00:00Z");
  const product = {
    price: 150,
    compareAtPrice: 180,
    skus: [{ price: 150, compareAtPrice: 180 }],
  };

  it("keeps the crossed-out price while a scheme applies", () => {
    const p = { ...product, offers: [{ endsAt: "2026-11-25T00:00:00Z" }] };
    expect(withSchemeBackedDiscounts(p, now)).toBe(p);
  });

  it("drops it when no scheme applies, on the product and its sizes", () => {
    const p = withSchemeBackedDiscounts({ ...product, offers: [] }, now);
    expect(p.compareAtPrice).toBeUndefined();
    expect(p.skus[0].compareAtPrice).toBeUndefined();
    expect(p.price).toBe(150);
  });

  it("drops it when the only scheme has ended or hasn't started", () => {
    const ended = { ...product, offers: [{ endsAt: "2026-11-21T00:00:00Z" }] };
    const later = { ...product, offers: [{ startsAt: "2026-11-23T00:00:00Z" }] };
    expect(withSchemeBackedDiscounts(ended, now).compareAtPrice).toBeUndefined();
    expect(withSchemeBackedDiscounts(later, now).compareAtPrice).toBeUndefined();
  });
});
