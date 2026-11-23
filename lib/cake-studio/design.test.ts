import { describe, expect, it } from "vitest";
import {
  applyChange,
  deckChoices,
  deckImpact,
  designProblems,
  pushHistory,
  shapeImpact,
  shapeProblem,
  sizeProblem,
  startingDesign,
  type Menu,
} from "./design";

const opt = (id: number, name: string, extra: object = {}) => ({
  id,
  name,
  price: 0,
  needsDrip: false,
  ...extra,
});

// 1 kg: round, square 3900, heart 4150 · 3 kg (two tiers): round, square only.
const menu: Menu = {
  sizes: [
    {
      id: 1,
      name: "1 kg",
      weightKg: 1,
      tiers: [{ width: 1.8, height: 0.8 }],
      servesMin: 8,
      servesMax: 10,
      shapePrices: { "10": 3900, "11": 3900, "12": 4150 },
      fromPrice: 3900,
      earliest: "2026-11-26",
    },
    {
      id: 3,
      name: "3 kg",
      weightKg: 3,
      tiers: [
        { width: 2.4, height: 0.78 },
        { width: 1.6, height: 0.72 },
      ],
      servesMin: 25,
      servesMax: 30,
      shapePrices: { "10": 11500, "11": 11500 },
      fromPrice: 11500,
      earliest: "2026-11-26",
    },
  ],
  shapes: [
    { id: 10, name: "Round", model: "round" },
    { id: 11, name: "Square", model: "square" },
    { id: 12, name: "Heart", model: "heart" },
  ],
  options: {
    sponge: [opt(20, "Butter"), opt(21, "Chocolate", { price: 300 })],
    filling: [opt(30, "Vanilla cream")],
    frosting: [opt(40, "White", { colour: "#FFFAF0" })],
    finish: [opt(50, "Smooth"), opt(51, "Drip", { price: 350, needsDrip: true })],
    drip: [opt(60, "Chocolate", { colour: "#4A2A1A" })],
    topping: [
      opt(70, "Sprinkles", { price: 150 }),
      opt(71, "Candles", { price: 100, maxCount: 12 }),
    ],
    writing_colour: [opt(80, "Chocolate")],
    lettering: [opt(90, "Script")],
    extra: [opt(100, "Gold number topper", { code: "number_topper", price: 350 })],
  },
  occasions: [],
  rules: { isOpen: true, messageMax: 24, photoMaxKb: 4096, deckPrices: { "2": 2500, "3": 3500 } },
};

describe("startingDesign", () => {
  it("starts with the size, its cheapest shape and the first required options", () => {
    expect(startingDesign(menu, 3)).toMatchObject({
      size_id: 3,
      tier_count: 2,
      shape_id: 10,
      sponge_id: 20,
      frosting_id: 40,
      finish_id: 50,
    });
  });
});

describe("what can be combined", () => {
  it("says why a shape or size can't be chosen", () => {
    const big = startingDesign(menu, 3);
    expect(shapeProblem(menu, big, 12)).toBe("A 3 kg cake isn't made heart.");
    expect(shapeProblem(menu, big, 11)).toBeNull();
    const heart = { ...startingDesign(menu, 1), shape_id: 12 };
    expect(sizeProblem(menu, heart, 3)).toBe("Not made heart.");
    expect(sizeProblem(menu, heart, 1)).toBeNull();
  });

  it("shows each choice's price impact", () => {
    const design = startingDesign(menu, 1);
    expect(shapeImpact(menu, design, 12)).toBe(250);
    expect(shapeImpact(menu, startingDesign(menu, 3), 12)).toBeNull();
    expect(deckChoices(menu, 1)).toEqual([1, 2, 3]);
    expect(deckImpact(menu, 1, 3)).toBe(6000);
    expect(deckChoices(menu, 3)).toEqual([2, 3]);
    expect(deckImpact(menu, 3, 3)).toBe(3500);
  });
});

describe("applyChange", () => {
  it("moves the shape and decks when a size needs it", () => {
    const heart = { ...startingDesign(menu, 1), shape_id: 12 };
    expect(applyChange(menu, heart, { size_id: 3 })).toMatchObject({ shape_id: 10, tier_count: 2 });
  });

  it("adds or clears the drip with the finish", () => {
    const d = startingDesign(menu, 1);
    const drip = applyChange(menu, d, { finish_id: 51 });
    expect(drip.drip_id).toBe(60);
    expect(applyChange(menu, drip, { finish_id: 50 }).drip_id).toBeNull();
  });

  it("keeps candles within their limit and clears the count without them", () => {
    const d = startingDesign(menu, 1);
    const candles = applyChange(menu, d, { topping_ids: [71], candle_count: 40 });
    expect(candles.candle_count).toBe(12);
    expect(applyChange(menu, candles, { topping_ids: [70] }).candle_count).toBeNull();
  });

  it("adds lettering with a message and clears it without one", () => {
    const d = applyChange(menu, startingDesign(menu, 1), { message: "Happy Birthday" });
    expect(d).toMatchObject({ lettering_id: 90, writing_colour_id: 80 });
    expect(applyChange(menu, d, { message: "" })).toMatchObject({
      lettering_id: null,
      writing_colour_id: null,
    });
    expect(applyChange(menu, d, { message: "x".repeat(40) }).message).toHaveLength(24);
  });
});

describe("designProblems and history", () => {
  it("lists what the ERP would refuse", () => {
    const d = { ...startingDesign(menu, 3), shape_id: 12, extras: ["number_topper"] };
    expect(designProblems(menu, d)).toEqual({
      shape_id: "A 3 kg cake isn't made heart.",
      topper_number: "Give the number for the topper, up to 3 digits.",
    });
    expect(designProblems(menu, startingDesign(menu, 1))).toEqual({});
  });

  it("keeps the last 30 designs for Undo", () => {
    let history: ReturnType<typeof startingDesign>[] = [];
    for (let i = 0; i < 40; i++) history = pushHistory(history, startingDesign(menu, 1));
    expect(history).toHaveLength(30);
  });
});
