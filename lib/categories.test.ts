import { describe, expect, it } from "vitest";
import {
  buildCategoryTree,
  categoryChoices,
  categoryTrail,
  descendantSlugs,
  popularCategories,
  sortByErpOrder,
  topLevelCategories,
} from "./categories";
import type { Category } from "@/lib/erp";

const cat = (id: string, sortOrder?: number, parentId?: string): Category => ({
  id,
  slug: id,
  name: id.toUpperCase(),
  description: "",
  sortOrder,
  parentId,
});

describe("sortByErpOrder", () => {
  it("uses the ERP sort order, never the name", () => {
    const sorted = sortByErpOrder([cat("apple", 3), cat("zebra", 1), cat("mango", 2)]);
    expect(sorted.map((c) => c.slug)).toEqual(["zebra", "mango", "apple"]);
  });

  it("keeps the ERP's order for ties and puts unsorted ones last, in the order received", () => {
    const sorted = sortByErpOrder([cat("x"), cat("b", 1), cat("y"), cat("a", 1)]);
    expect(sorted.map((c) => c.slug)).toEqual(["b", "a", "x", "y"]);
  });
});

describe("buildCategoryTree", () => {
  const categories = [
    cat("cakes", 2),
    cat("buns", 1),
    cat("birthday", 2, "cakes"),
    cat("wedding", 1, "cakes"),
    cat("orphan", 5, "deleted-parent"),
  ];

  it("nests sub-categories under their parent, each level in ERP order", () => {
    const tree = buildCategoryTree(categories);
    expect(tree.map((n) => n.slug)).toEqual(["buns", "cakes", "orphan"]);
    expect(tree[1].children.map((n) => n.slug)).toEqual(["wedding", "birthday"]);
  });

  it("shows a category whose parent is missing at the top level instead of hiding it", () => {
    expect(topLevelCategories(categories).map((c) => c.slug)).toEqual(["buns", "cakes", "orphan"]);
  });

  it("survives a category that lists itself as parent", () => {
    expect(buildCategoryTree([cat("loop", 1, "loop")]).map((n) => n.slug)).toEqual(["loop"]);
  });
});

describe("categoryTrail and descendantSlugs", () => {
  const categories = [cat("cakes", 1), cat("birthday", 1, "cakes"), cat("kids", 1, "birthday")];

  it("returns the category with its parents, root first", () => {
    expect(categoryTrail(categories, "kids").map((c) => c.slug)).toEqual([
      "cakes",
      "birthday",
      "kids",
    ]);
  });

  it("returns a category with all its sub-categories", () => {
    expect(descendantSlugs(categories, "cakes")).toEqual(["cakes", "birthday", "kids"]);
  });
});

describe("popularCategories", () => {
  // cakes (1) › birthday (3); buns (2); drinks (4)
  const categories = [
    cat("cakes", 1),
    cat("birthday", 3, "cakes"),
    cat("buns", 2),
    cat("drinks", 4),
  ];

  it("ranks top-level categories by their products' popularity, sub-categories included", () => {
    const products = [
      { categorySlug: "buns", popularity: 10 },
      { categorySlug: "birthday", popularity: 30 },
      { categorySlug: "drinks", popularity: 5 },
    ];
    expect(popularCategories(categories, products).map((c) => c.slug)).toEqual([
      "cakes",
      "buns",
      "drinks",
    ]);
  });

  it("keeps the ERP order without popularity data, and respects the limit", () => {
    expect(popularCategories(categories, [], 2).map((c) => c.slug)).toEqual(["cakes", "buns"]);
  });
});

describe("categoryChoices", () => {
  const categories = [
    cat("cakes", 1),
    cat("birthday", 3, "cakes"),
    cat("kids", 1, "birthday"),
    cat("buns", 2),
  ];

  it("offers the sub-categories of the current category, each with its own sub-categories", () => {
    expect(categoryChoices(categories, "cakes")).toEqual([
      { slug: "birthday", name: "BIRTHDAY", slugs: ["birthday", "kids"] },
    ]);
  });

  it("offers the top-level categories without a parent (search)", () => {
    expect(categoryChoices(categories).map((c) => [c.slug, c.slugs])).toEqual([
      ["cakes", ["cakes", "birthday", "kids"]],
      ["buns", ["buns"]],
    ]);
  });
});
