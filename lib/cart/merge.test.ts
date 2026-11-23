import { describe, expect, it } from "vitest";
import { MAX_CART_LINES } from "./limits";
import { mergeCarts, unionCarts } from "./merge";

const line = (key: string, quantity: number, name = key) => ({ key, quantity, name });

describe("mergeCarts (sign-in)", () => {
  it("keeps the guest's items and the customer's saved items", () => {
    const { lines } = mergeCarts([line("cake:s1", 1)], [line("fish-bun", 3)]);
    expect(lines.map((l) => [l.key, l.quantity])).toEqual([
      ["cake:s1", 1],
      ["fish-bun", 3],
    ]);
  });

  it("adds up the same product into one line, with the guest's latest details", () => {
    const { lines } = mergeCarts(
      [line("fish-bun", 2, "Old name")],
      [line("fish-bun", 3, "Fish bun")],
    );
    expect(lines).toEqual([{ key: "fish-bun", quantity: 5, name: "Fish bun" }]);
  });

  it("keeps a design and the same product without one as separate lines", () => {
    const { lines } = mergeCarts([line("cake", 1)], [line("cake:design-d1", 1)]);
    expect(lines.map((l) => l.key)).toEqual(["cake", "cake:design-d1"]);
  });

  it("never goes over 99 per line", () => {
    expect(mergeCarts([line("fish-bun", 60)], [line("fish-bun", 60)]).lines[0].quantity).toBe(99);
  });

  it("keeps at most 50 lines and says how many were left out", () => {
    const saved = Array.from({ length: 49 }, (_, i) => line(`p${i}`, 1));
    const { lines, dropped } = mergeCarts(saved, [line("a", 1), line("b", 1), line("c", 1)]);
    expect(lines).toHaveLength(MAX_CART_LINES);
    expect(dropped).toBe(2);
  });

  it("changes nothing for an empty guest cart", () => {
    expect(mergeCarts([line("fish-bun", 2)], []).lines).toEqual([line("fish-bun", 2)]);
  });
});

describe("unionCarts (a save that crossed a newer saved cart)", () => {
  it("keeps the saved cart and adds lines only this browser has, without counting twice", () => {
    const merged = unionCarts(
      [line("fish-bun", 5), line("cake:s1", 1)],
      [line("fish-bun", 3), line("sausage-bun", 2)],
    );
    expect(merged.map((l) => [l.key, l.quantity])).toEqual([
      ["fish-bun", 5],
      ["cake:s1", 1],
      ["sausage-bun", 2],
    ]);
  });
});
