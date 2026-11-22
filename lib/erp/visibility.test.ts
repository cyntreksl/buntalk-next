import { describe, expect, it } from "vitest";
import type { ErpCategory } from "./schemas";
import { isProductVisible, isSkuVisible, visibleCategoryIds } from "./visibility";

const cat = (
  id: string,
  extra: Partial<Pick<ErpCategory, "is_active" | "visible_online" | "parent_link_id">> = {},
): ErpCategory => ({ link_id: id, slug: id, name: id, is_active: true, ...extra });

const product = (
  categoryId: string,
  extra: { is_active?: boolean; visible_online?: boolean } = {},
) => ({
  is_active: true,
  ...extra,
  category: { link_id: categoryId, slug: categoryId, name: categoryId },
});

describe("visibleCategoryIds", () => {
  it("hides inactive categories and ones switched off for the website", () => {
    const ids = visibleCategoryIds([
      cat("shown"),
      cat("inactive", { is_active: false }),
      cat("offline", { visible_online: false }),
      cat("explicitly-on", { visible_online: true }),
    ]);
    expect([...ids]).toEqual(["shown", "explicitly-on"]);
  });

  it("hides every sub-category under a hidden parent", () => {
    const ids = visibleCategoryIds([
      cat("cakes", { visible_online: false }),
      cat("birthday", { parent_link_id: "cakes" }),
      cat("kids", { parent_link_id: "birthday" }),
      cat("buns"),
    ]);
    expect([...ids]).toEqual(["buns"]);
  });

  it("keeps a category whose parent isn't in the list, and survives loops", () => {
    const ids = visibleCategoryIds([
      cat("orphan", { parent_link_id: "deleted" }),
      cat("a", { parent_link_id: "b" }),
      cat("b", { parent_link_id: "a" }),
    ]);
    expect([...ids]).toEqual(["orphan", "a", "b"]);
  });
});

describe("isProductVisible", () => {
  const ids = new Set(["buns"]);

  it("shows an active product in a visible category (visible_online missing = visible)", () => {
    expect(isProductVisible(product("buns"), ids)).toBe(true);
  });

  it("hides a product that is inactive or switched off for the website", () => {
    expect(isProductVisible(product("buns", { is_active: false }), ids)).toBe(false);
    expect(isProductVisible(product("buns", { visible_online: false }), ids)).toBe(false);
  });

  it("hides a product whose category is hidden", () => {
    expect(isProductVisible(product("hidden-category"), ids)).toBe(false);
  });
});

describe("isSkuVisible", () => {
  it("hides inactive SKUs and ones switched off for the website", () => {
    expect(isSkuVisible({ is_active: true })).toBe(true);
    expect(isSkuVisible({ is_active: false })).toBe(false);
    expect(isSkuVisible({ is_active: true, visible_online: false })).toBe(false);
  });
});
