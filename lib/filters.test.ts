import { describe, expect, it } from "vitest";
import {
  activeCount,
  applyFilters,
  buildFacets,
  filterParams,
  groupKey,
  parseFilters,
  type CategoryChoice,
  type Filterable,
} from "./filters";

const p = (slug: string, x: Partial<Filterable> = {}): Filterable => ({
  slug,
  categorySlug: "buns",
  price: 100,
  ...x,
});

const products = [
  p("fish-bun", { price: 120, offers: [{}] }),
  p("sausage-bun", { price: 150, compareAtPrice: 180 }),
  p("choc-cake", {
    categorySlug: "birthday-cakes",
    price: 4500,
    attributes: [
      { name: "Size", values: ["1 kg", "2 kg"] },
      { name: "Flavour", values: ["Chocolate"] },
    ],
    tags: [{ group: "Occasion", value: "Birthday" }],
  }),
  p("vanilla-cake", {
    categorySlug: "wedding-cakes",
    price: 6000,
    attributes: [
      { name: "Size", values: ["2 kg"] },
      { name: "Flavour", values: ["Vanilla"] },
    ],
    tags: [{ group: "Occasion", value: "Wedding" }],
  }),
];

const choices: CategoryChoice[] = [
  { slug: "buns", name: "Buns", slugs: ["buns"] },
  { slug: "cakes", name: "Cakes", slugs: ["cakes", "birthday-cakes", "wedding-cakes"] },
  { slug: "drinks", name: "Drinks", slugs: ["drinks"] },
];

const run = (params: Record<string, string | string[]>) => {
  const state = parseFilters(params, products, choices);
  return { state, slugs: applyFilters(products, state, choices).map((x) => x.slug) };
};

describe("parseFilters", () => {
  it("reads categories, price, offer and option groups", () => {
    const { state } = run({ cat: "cakes", min: "100", max: "5000", offer: "1", size: ["1 kg"] });
    expect(state).toEqual({
      categories: ["cakes"],
      min: 100,
      max: 5000,
      offer: true,
      groups: { size: ["1 kg"] },
    });
  });

  it("ignores unknown keys and categories, bad numbers, and swaps a reversed range", () => {
    const { state } = run({ utm_source: "x", cat: "nope", min: "abc", sort: "newest" });
    expect(state).toEqual({
      categories: [],
      min: undefined,
      max: undefined,
      offer: false,
      groups: {},
    });
    expect(run({ min: "500", max: "100" }).state).toMatchObject({ min: 100, max: 500 });
    expect(run({ min: "", max: " " }).state).toMatchObject({ min: undefined, max: undefined });
  });
});

describe("applyFilters", () => {
  it("includes sub-categories of a chosen category", () => {
    expect(run({ cat: "cakes" }).slugs).toEqual(["choc-cake", "vanilla-cake"]);
  });

  it("filters by price range and by offers", () => {
    expect(run({ min: "130", max: "5000" }).slugs).toEqual(["sausage-bun", "choc-cake"]);
    expect(run({ offer: "1" }).slugs).toEqual(["fish-bun", "sausage-bun"]);
  });

  it("matches any value within a group, and every group", () => {
    expect(run({ size: ["1 kg", "2 kg"] }).slugs).toEqual(["choc-cake", "vanilla-cake"]);
    expect(run({ size: "2 kg", flavour: "Vanilla" }).slugs).toEqual(["vanilla-cake"]);
    expect(run({ occasion: "Birthday" }).slugs).toEqual(["choc-cake"]);
  });
});

describe("buildFacets", () => {
  it("lists only options that exist in the current results, with counts", () => {
    const { state } = run({ cat: "buns" });
    const facets = buildFacets(products, state, choices);
    // Categories ignore their own filter (so another one can be added); Drinks has no products.
    expect(facets.categories.map((o) => [o.value, o.count, o.selected])).toEqual([
      ["buns", 2, true],
      ["cakes", 2, false],
    ]);
    // Only buns are left, and they have no sizes or flavours.
    expect(facets.groups).toEqual([]);
    expect(facets.price).toEqual({ min: 120, max: 150 });
    expect(facets.offer).toEqual({ count: 2, selected: false });
  });

  it("counts each group's options with the other filters applied", () => {
    const { state } = run({ flavour: "Vanilla" });
    const size = buildFacets(products, state, choices).groups.find((g) => g.key === "size");
    expect(size?.options.map((o) => [o.value, o.count])).toEqual([["2 kg", 1]]);
    const flavour = buildFacets(products, state, choices).groups.find((g) => g.key === "flavour");
    expect(flavour?.options.map((o) => [o.value, o.count, o.selected])).toEqual([
      ["Chocolate", 1, false],
      ["Vanilla", 1, true],
    ]);
  });
});

describe("helpers", () => {
  it("makes group keys and URL parameters, and counts active filters", () => {
    expect(groupKey("Cake Size")).toBe("cake-size");
    const { state } = run({ cat: "cakes", offer: "1", size: ["1 kg", "2 kg"], max: "9000" });
    expect(activeCount(state)).toBe(5);
    expect(filterParams(state)).toEqual([
      ["cat", "cakes"],
      ["max", "9000"],
      ["offer", "1"],
      ["size", "1 kg"],
      ["size", "2 kg"],
    ]);
  });
});
