import { describe, expect, it } from "vitest";
import type { Scheme } from "@/lib/erp";
import {
  displayPrice,
  isWithinWindow,
  nextOfferChange,
  offerValidity,
  offersFor,
  personalPriceFor,
  priceNow,
  schemeLabel,
  withSchemeBackedDiscounts,
} from "./offers";

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

describe("offer timing (BUN-174)", () => {
  // 22 Nov 2026, 10:00 in Colombo.
  const now = Date.parse("2026-11-22T04:30:00Z");

  it("words the end date in Sri Lanka time", () => {
    expect(offerValidity({ endsAt: "2026-11-22T12:30:00Z" }, now)).toMatch(
      /^Ends today at 6:00\s?pm$/,
    );
    expect(offerValidity({ endsAt: "2026-11-23T03:30:00Z" }, now)).toMatch(
      /^Ends tomorrow at 9:00\s?am$/,
    );
    expect(offerValidity({ endsAt: "2026-11-28T10:00:00Z" }, now)).toMatch(
      /^Valid until Sat,? 28 Nov$/,
    );
    expect(offerValidity({}, now)).toBeNull();
    // Cached HTML (time not known yet): always the date.
    expect(offerValidity({ endsAt: "2026-11-22T12:30:00Z" }, null)).toMatch(
      /^Valid until Sun,? 22 Nov$/,
    );
  });

  it("finds the next start or end", () => {
    expect(
      nextOfferChange(
        [
          { endsAt: "2026-11-20T00:00:00Z" },
          { startsAt: "2026-11-24T00:00:00Z", endsAt: "2026-11-26T00:00:00Z" },
          { endsAt: "2026-11-23T00:00:00Z" },
        ],
        now,
      ),
    ).toBe(Date.parse("2026-11-23T00:00:00Z"));
    expect(nextOfferChange([{}], now)).toBeNull();
  });

  it("shows the original price once the scheme behind a discount has ended", () => {
    const shown = { price: 150, compareAtPrice: 180 };
    expect(priceNow(shown, [{ endsAt: "2026-11-25T00:00:00Z" }], now)).toEqual(shown);
    expect(priceNow(shown, [{ endsAt: "2026-11-21T00:00:00Z" }], now)).toEqual({
      price: 180,
      compareAtPrice: undefined,
    });
    expect(priceNow({ price: 90 }, [], now)).toEqual({ price: 90 });
    // No offers known at all (e.g. sample data): leave it as the page has it.
    expect(priceNow(shown, [], now)).toEqual(shown);
  });
});

describe("displayPrice and personalPriceFor (BUN-174)", () => {
  const now = Date.parse("2026-11-22T04:30:00Z");
  const live = [{ endsAt: "2026-11-25T00:00:00Z" }];
  const ended = [{ endsAt: "2026-11-21T00:00:00Z" }];

  it("shows the ERP price, corrected once the offer has ended", () => {
    expect(displayPrice({ price: 150, compareAtPrice: 180 }, { offers: live, now })).toEqual({
      price: 150,
      compareAtPrice: 180,
      yourPrice: false,
    });
    expect(displayPrice({ price: 150, compareAtPrice: 180 }, { offers: ended, now })).toEqual({
      price: 180,
      compareAtPrice: undefined,
      yourPrice: false,
    });
    // Cached HTML before the browser knows the time: as the page has it.
    expect(displayPrice({ price: 150, compareAtPrice: 180 }, { offers: ended, now: null })).toEqual(
      { price: 150, compareAtPrice: 180, yourPrice: false },
    );
  });

  it("shows the customer's own price, with the usual price crossed out when higher", () => {
    expect(displayPrice({ price: 120 }, { now, personal: 100 })).toEqual({
      price: 100,
      compareAtPrice: 120,
      yourPrice: true,
    });
    expect(displayPrice({ price: 120 }, { now, personal: 130 })).toEqual({
      price: 130,
      compareAtPrice: undefined,
      yourPrice: true,
    });
    expect(displayPrice({ price: 120 }, { now, personal: 120 })).toMatchObject({
      yourPrice: false,
    });
  });

  it("picks the size's price, or the lowest size price", () => {
    const entry = { price: 4500, skus: { s1: 4000, s2: 7600 } };
    expect(personalPriceFor(entry, "s2")).toBe(7600);
    expect(personalPriceFor(entry)).toBe(4000);
    expect(personalPriceFor({ price: 100, skus: {} })).toBe(100);
    expect(personalPriceFor(undefined)).toBeUndefined();
  });
});
