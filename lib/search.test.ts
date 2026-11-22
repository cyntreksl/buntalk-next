import { describe, expect, it } from "vitest";
import { editDistance, normalize, searchCatalog, searchCategories, searchKey } from "./search";

const p = (
  slug: string,
  name: string,
  extra: Partial<Parameters<typeof searchCatalog>[0][0]> = {},
) => ({
  slug,
  name,
  description: "",
  categorySlug: "buns",
  featured: false,
  ...extra,
});

const products = [
  p("fish-bun", "Fish bun", { description: "Spicy fish and potato filling", code: "MK-001" }),
  p("sausage-bun", "Sausage bun"),
  p("choc-cake", "Chocolate birthday cake", { categorySlug: "birthday-cakes" }),
  p("veg-roll", "Vegetable roll", { categorySlug: "short-eats" }),
  p("coconut-bun", "Coconut bun", { featured: true }),
];
const slugs = (q: string, cats?: Map<string, string>) =>
  searchCatalog(products, q, cats).map((x) => x.slug);

describe("normalize", () => {
  it("drops accents, case and punctuation", () => {
    expect(normalize("  Crème-Brûlée!! ")).toBe("creme brulee");
  });
});

describe("editDistance", () => {
  it("counts a swap of two letters as one typo", () => {
    expect(editDistance("chcoolate", "chocolate", 2)).toBe(1);
    expect(editDistance("sausge", "sausage", 1)).toBe(1);
    expect(editDistance("cake", "bread", 1)).toBe(2);
  });
});

describe("searchCatalog", () => {
  it("finds whole words and partial words", () => {
    expect(slugs("fish")).toEqual(["fish-bun"]);
    expect(slugs("choc")).toEqual(["choc-cake"]);
    expect(slugs("veg ro")).toEqual(["veg-roll"]);
  });

  it("tolerates small typos", () => {
    expect(slugs("sausge")).toEqual(["sausage-bun"]);
    expect(slugs("chocolat cak")).toEqual(["choc-cake"]);
    expect(slugs("birthdy")).toEqual(["choc-cake"]);
  });

  it("doesn't guess on very short words", () => {
    expect(slugs("bum")).toEqual([]);
  });

  it("needs every word to match", () => {
    expect(slugs("fish cake")).toEqual([]);
  });

  it("ranks name matches first, then featured", () => {
    expect(slugs("bun")).toEqual(["coconut-bun", "fish-bun", "sausage-bun"]);
  });

  it("matches the item code, category name and description", () => {
    expect(slugs("mk-001")).toEqual(["fish-bun"]);
    expect(slugs("short eats", new Map([["short-eats", "Short eats"]]))).toEqual(["veg-roll"]);
    expect(slugs("potato")).toEqual(["fish-bun"]);
  });

  it("returns nothing for an empty query", () => {
    expect(slugs("  ")).toEqual([]);
  });
});

describe("searchCategories", () => {
  it("matches category names with typos, best first", () => {
    const cats = [{ name: "Short eats" }, { name: "Birthday cakes" }, { name: "Cakes" }];
    expect(searchCategories(cats, "cakes").map((c) => c.name)).toEqual(["Cakes", "Birthday cakes"]);
    expect(searchCategories(cats, "birthdy").map((c) => c.name)).toEqual(["Birthday cakes"]);
  });
});

describe("searchKey", () => {
  it("normalises and limits the stored query", () => {
    expect(searchKey(" Fish  BUN ")).toBe("fish bun");
    expect(searchKey("x".repeat(300))).toHaveLength(100);
  });
});
