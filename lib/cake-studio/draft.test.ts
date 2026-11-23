import { describe, expect, it } from "vitest";
import { startingDesign, type Menu } from "./design";
import { DRAFT_DAYS, draftKey, noticeText, parseDraft, readyDateText } from "./draft";

const menu = {
  sizes: [{ id: 1, name: "1 kg", tiers: [{ width: 2, height: 0.8 }], shapePrices: { "10": 3900 } }],
  shapes: [{ id: 10, name: "Round", model: "round" }],
  options: {
    sponge: [{ id: 20, name: "Vanilla", price: 0, needsDrip: false }],
    filling: [],
    frosting: [{ id: 40, name: "White", price: 0, needsDrip: false }],
    finish: [{ id: 50, name: "Smooth", price: 0, needsDrip: false }],
    drip: [],
    topping: [
      { id: 70, name: "Berries", price: 450, needsDrip: false },
      { id: 71, name: "Candles", price: 100, needsDrip: false, maxCount: 12 },
    ],
    writing_colour: [{ id: 80, name: "Brown", price: 0, needsDrip: false }],
    lettering: [{ id: 90, name: "Script", price: 0, needsDrip: false }],
    extra: [{ id: 95, code: "eggless", name: "Eggless", price: 300, needsDrip: false }],
  },
  occasions: [],
  rules: { isOpen: true, messageMax: 24, photoMaxKb: 4096, deckPrices: {} },
} as unknown as Menu;

const now = Date.UTC(2026, 10, 23, 10);
const stored = (design: unknown, savedAt = now) => JSON.stringify({ design, savedAt });
const start = startingDesign(menu);

describe("cake drafts", () => {
  it("names a draft by where the designer started", () => {
    expect(draftKey({})).toMatch(/:new$/);
    expect(draftKey({ sizeId: 4 })).toMatch(/:size-4$/);
    expect(draftKey({ favouriteId: 2, sizeId: 4 })).toMatch(/:favourite-2$/);
    expect(draftKey({ designId: "abc", favouriteId: 2 })).toMatch(/:design-abc$/);
  });

  it("restores the design the customer was working on", () => {
    const design = { ...start, topping_ids: [70, 71], candle_count: 3, message: "Happy 30th" };
    const restored = parseDraft(stored(design), menu, now);
    expect(restored).toMatchObject({
      topping_ids: [70, 71],
      candle_count: 3,
      message: "Happy 30th",
    });
    // Tidied as in the designer: a message gets its lettering and colour.
    expect(restored).toMatchObject({ lettering_id: 90, writing_colour_id: 80 });
  });

  it("drops toppings and extras that left the menu, but keeps the rest", () => {
    const design = { ...start, topping_ids: [70, 999], extras: ["eggless", "gold_leaf"] };
    expect(parseDraft(stored(design), menu, now)).toMatchObject({
      topping_ids: [70],
      extras: ["eggless"],
    });
  });

  it("forgets a draft that is old, broken, or for a size or flavour no longer made", () => {
    expect(parseDraft("", menu, now)).toBeNull();
    expect(parseDraft("{not json", menu, now)).toBeNull();
    expect(parseDraft(stored({ size_id: "x" }), menu, now)).toBeNull();
    expect(parseDraft(stored(start, now - (DRAFT_DAYS + 1) * 86_400_000), menu, now)).toBeNull();
    expect(parseDraft(stored({ ...start, size_id: 2 }), menu, now)).toBeNull();
    expect(parseDraft(stored({ ...start, sponge_id: 21 }), menu, now)).toBeNull();
  });
});

describe("ready date and notice", () => {
  it("writes the ERP's date as a calendar day, whatever the time zone", () => {
    expect(readyDateText("2026-11-27")).toBe("Friday 27 November");
    expect(readyDateText("soon")).toBe("soon");
  });

  it("says the notice in days or hours", () => {
    expect(noticeText(48)).toBe("2 days'");
    expect(noticeText(24)).toBe("a day's");
    expect(noticeText(12)).toBe("12 hours'");
    expect(noticeText(1)).toBe("an hour's");
  });
});
