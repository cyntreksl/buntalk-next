import { describe, expect, it } from "vitest";
import { deckHeightsCm, guessStyle, lookFor, tiersFor } from "./look";
import { startingDesign, type Menu } from "./design";

const menu = {
  sizes: [
    {
      id: 1,
      name: "3 kg",
      tiers: [
        { width: 2.4, height: 0.78 },
        { width: 1.6, height: 0.72 },
      ],
      shapePrices: { "10": 11500 },
    },
  ],
  shapes: [{ id: 10, name: "Heart", model: "heart" }],
  options: {
    sponge: [
      { id: 20, name: "Ribbon", price: 0, needsDrip: false, layerColours: ["#F4A6B8", "#A8D5A2"] },
    ],
    filling: [],
    frosting: [{ id: 40, name: "Pink", price: 0, needsDrip: false, colour: "#F7B6C8" }],
    finish: [{ id: 50, name: "Chocolate drip", price: 350, needsDrip: true }],
    drip: [{ id: 60, name: "Caramel", price: 0, needsDrip: false, colour: "#C8843A" }],
    topping: [
      { id: 70, name: "Fresh berries", price: 450, needsDrip: false },
      { id: 71, name: "Candles", price: 100, needsDrip: false, maxCount: 12, style: "candles" },
    ],
    writing_colour: [{ id: 80, name: "Gold", price: 0, needsDrip: false, colour: "#B98A1E" }],
    lettering: [{ id: 90, name: "Bold", price: 0, needsDrip: false }],
    extra: [],
  },
  occasions: [],
  rules: { isOpen: true, messageMax: 24, photoMaxKb: 4096, deckPrices: {} },
} as unknown as Menu;

describe("lookFor", () => {
  it("turns the picks into what the 3D cake draws", () => {
    const design = {
      ...startingDesign(menu, 1),
      finish_id: 50,
      drip_id: 60,
      topping_ids: [70, 71],
      candle_count: 5,
      message: "  Happy 30th ",
      lettering_id: 90,
      writing_colour_id: 80,
    };
    expect(lookFor(menu, design, { view: "top" })).toMatchObject({
      model: "heart",
      tiers: [
        { width: 2.4, height: 0.8 },
        { width: 1.6, height: 0.7 },
      ],
      frosting: "#F7B6C8",
      spongeLayers: ["#F4A6B8", "#A8D5A2"],
      finish: "drip",
      drip: "#C8843A",
      toppings: [{ style: "fruit" }],
      candles: 5,
      message: "Happy 30th",
      lettering: "bold",
      writing: "#B98A1E",
      view: "top",
    });
  });
});

describe("decks", () => {
  it("keeps the size's own decks, and narrows extra ones from the bottom", () => {
    const own = [{ width: 2.4, height: 0.78 }];
    expect(deckHeightsCm(own, 1)).toEqual([8]);
    expect(deckHeightsCm(own, 3)).toEqual([8, 7, 7]);
    expect(tiersFor(own, 3, [8, 7, 7]).map((t) => t.width)).toEqual([2.4, 1.74, 1.08]);
  });

  it("guesses a style from a name", () => {
    expect(guessStyle("Piped border")).toBe("piped");
    expect(guessStyle("Plain")).toBeNull();
  });
});
