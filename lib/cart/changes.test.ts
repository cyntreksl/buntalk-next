import { describe, expect, it } from "vitest";
import { priceChangeText, priceChanges } from "./changes";

const shown = [
  { key: "fish-bun", name: "Fish bun", unitPrice: 120 },
  { key: "cake:s1", name: "Cake", variant: "1 kg", unitPrice: 4500 },
  { key: "new", name: "New", unitPrice: 0 },
];

describe("priceChanges", () => {
  it("finds lines whose ERP price is different from the one shown", () => {
    const changes = priceChanges(shown, [
      { key: "fish-bun", unitPrice: 110 },
      { key: "cake:s1", unitPrice: 4500 },
      { key: "new", unitPrice: 300 },
    ]);
    expect(changes).toEqual([{ key: "fish-bun", name: "Fish bun", from: 120, to: 110 }]);
  });

  it("ignores rounding dust and lines the server removed", () => {
    expect(priceChanges(shown, [{ key: "fish-bun", unitPrice: 120.001 }])).toEqual([]);
  });
});

// Prices are formatted with a non-breaking space after the currency.
const plain = (s: string | null) => s?.replace(/\s/g, " ") ?? null;

describe("priceChangeText", () => {
  it("words one or several changes", () => {
    expect(priceChangeText([], "LKR")).toBeNull();
    expect(
      plain(priceChangeText([{ key: "a", name: "Fish bun", from: 120, to: 110 }], "LKR")),
    ).toBe("The price of Fish bun changed from LKR 120.00 to LKR 110.00.");
    expect(
      plain(
        priceChangeText(
          [
            { key: "a", name: "Fish bun", from: 120, to: 110 },
            { key: "b", name: "Cake (1 kg)", from: 4500, to: 4000 },
          ],
          "LKR",
        ),
      ),
    ).toBe("Prices changed for Fish bun (now LKR 110.00) and Cake (1 kg) (now LKR 4,000.00).");
  });
});
