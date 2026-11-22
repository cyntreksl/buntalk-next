import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/erp";
import { availableSorts, paginate, parseListingParams, sortProducts } from "./listing";

const p = (slug: string, extra: Partial<Product> = {}): Product => ({
  slug,
  name: slug,
  description: "",
  price: 100,
  currency: "LKR",
  categorySlug: "buns",
  featured: false,
  ...extra,
});

describe("parseListingParams", () => {
  it("reads sort and page, falling back to safe defaults", () => {
    expect(parseListingParams({ sort: "price-asc", page: "3" })).toEqual({
      sort: "price-asc",
      page: 3,
    });
    expect(parseListingParams({})).toEqual({ sort: "recommended", page: 1 });
    expect(parseListingParams({ sort: "hack", page: "-2" })).toEqual({
      sort: "recommended",
      page: 1,
    });
    expect(parseListingParams({ sort: ["newest", "x"], page: "2.5" })).toEqual({
      sort: "newest",
      page: 1,
    });
  });
});

describe("sortProducts", () => {
  const list = [
    p("a", { price: 300 }),
    p("b", { price: 100, featured: true, popularity: 5 }),
    p("c", { price: 200, popularity: 50, createdAt: "2026-11-01T00:00:00Z" }),
    p("d", { price: 100, createdAt: "2026-11-20T00:00:00Z" }),
  ];
  const slugs = (sort: Parameters<typeof sortProducts>[1]) =>
    sortProducts(list, sort).map((x) => x.slug);

  it("recommended: featured first, then the ERP's order", () => {
    expect(slugs("recommended")).toEqual(["b", "a", "c", "d"]);
  });

  it("price: by the card price, ties keep the ERP's order", () => {
    expect(slugs("price-asc")).toEqual(["b", "d", "c", "a"]);
    expect(slugs("price-desc")).toEqual(["a", "c", "b", "d"]);
  });

  it("uses the lowest size price for products with sizes", () => {
    const sized = p("cake", {
      price: 9000,
      skus: [
        { id: "1", code: "1", options: [], price: 50, inStock: true },
        { id: "2", code: "2", options: [], price: 900, inStock: true },
      ],
    });
    expect(sortProducts([p("bun", { price: 100 }), sized], "price-asc").map((x) => x.slug)).toEqual(
      ["cake", "bun"],
    );
  });

  it("popular and newest put products without data last", () => {
    expect(slugs("popular")).toEqual(["c", "b", "a", "d"]);
    expect(slugs("newest")).toEqual(["d", "c", "a", "b"]);
  });

  it("never changes the input", () => {
    sortProducts(list, "price-desc");
    expect(list.map((x) => x.slug)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("availableSorts", () => {
  it("offers popular and newest only when the ERP sends that data", () => {
    expect(availableSorts([p("a")])).toEqual(["recommended", "price-asc", "price-desc"]);
    expect(availableSorts([p("a", { popularity: 1, createdAt: "2026-01-01" })])).toHaveLength(5);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 57 }, (_, i) => i + 1);

  it("cuts pages and reports the range shown", () => {
    expect(paginate(items, 1, 24)).toMatchObject({
      page: 1,
      totalPages: 3,
      total: 57,
      from: 1,
      to: 24,
      outOfRange: false,
    });
    const last = paginate(items, 3, 24);
    expect(last).toMatchObject({ from: 49, to: 57, outOfRange: false });
    expect(last.items).toHaveLength(9);
  });

  it("flags a page past the end, and handles an empty list", () => {
    expect(paginate(items, 9, 24).outOfRange).toBe(true);
    expect(paginate([], 1, 24)).toMatchObject({ totalPages: 1, from: 0, to: 0, outOfRange: false });
  });
});
