import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// The mock ERP's Cake Studio follows the real ERP's rules (sample menu, pricing,
// checks), so the storefront client is tested against it end to end.
import {
  handleCakeStudio,
  patchCakeStudio,
  seedCakeStudio,
} from "../../scripts/mock-erp-cake-studio.mjs";
import { ErpNotFoundError, ErpValidationError } from "./errors";
import { transport } from "./http";

vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));

const { getCakeDesign, getCakeStudioMenu, quoteCakeDesign, saveCakeDesign } =
  await import("./cake-studio");

const original = { ...transport };
let studio: ReturnType<typeof seedCakeStudio>;

beforeEach(() => {
  studio = seedCakeStudio();
  transport.config = () => ({
    baseUrl: "https://erp.test/api",
    apiKey: "test-key",
    tenant: "buntalk",
    timeoutMs: 1000,
  });
  transport.log = () => {};
  transport.sleep = async () => {};
  transport.fetch = async (input, init) => {
    const url = new URL(input);
    const route = url.pathname.replace("/api/v1/tenants/buntalk/storefront", "");
    const body = init.body ? JSON.parse(String(init.body)) : null;
    const result = handleCakeStudio(studio, route, init.method ?? "GET", body) as
      [number, unknown] | null;
    const [status, payload] = result ?? [404, { message: "Not Found" }];
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
});

afterEach(() => {
  Object.assign(transport, original);
});

const option = (kind: string, name: string) =>
  studio.options.find((o) => o.kind === kind && o.name === name)!.id;

const design = () => ({
  size_id: studio.sizes[0].id, // 1 kg, LKR 3,900
  shape_id: studio.shapes[2].id, // Heart, + 250
  sponge_id: option("sponge", "Chocolate"), // + 300
  filling_id: option("filling", "Vanilla cream"), // free
  frosting_id: option("frosting", "Pink"),
  finish_id: option("finish", "Piped border"), // + 300
  topping_ids: [option("topping", "Candles")], // + 100
  candle_count: 5,
  message: "Happy 30th",
});

describe("Cake Studio menu", () => {
  it("shows the ERP's menu with its prices, every option kind present", async () => {
    const menu = await getCakeStudioMenu();
    expect(menu.sizes.map((s) => [s.name, s.fromPrice])).toEqual([
      ["1 kg", 3900],
      ["2 kg", 7200],
      ["3 kg", 11500],
    ]);
    // Heart costs 250 more and isn't made in 3 kg.
    expect(Object.values(menu.sizes[0].shapePrices)).toEqual([3900, 3900, 4150]);
    expect(Object.keys(menu.sizes[2].shapePrices)).toHaveLength(2);
    expect(menu.options.sponge.map((o) => [o.name, o.price])).toContainEqual(["Chocolate", 300]);
    expect(menu.options.frosting[0].colour).toBe("#FFFAF0");
    expect(menu.options.topping.find((t) => t.name === "Candles")?.maxCount).toBe(12);
    expect(menu.rules).toMatchObject({ isOpen: true, messageMax: 24 });
  });
});

describe("Cake Studio quotes", () => {
  it("returns the ERP's price lines, total and summary", async () => {
    const quote = await quoteCakeDesign(design());
    expect(quote.lines.map((l) => [l.label, l.price])).toEqual([
      ["1 kg heart cake", 4150],
      ["Chocolate sponge", 300],
      ["Piped border finish", 300],
      ["Candles, 5", 100],
    ]);
    expect(quote.total).toBe(4850);
    expect(quote.summary.find((r) => r.label === "Message")?.value).toContain('"Happy 30th"');
  });

  it("passes on the ERP's message for a design it refuses", async () => {
    const error = await quoteCakeDesign({ ...design(), shape_id: 9999 }).catch((e) => e);
    expect(error).toBeInstanceOf(ErpValidationError);
    expect((error as ErpValidationError).fieldErrors.shape_id).toEqual(["Choose a shape."]);
  });
});

describe("saved designs", () => {
  it("saves a design and loads it again by its id", async () => {
    const saved = await saveCakeDesign(design(), { idempotencyKey: "k1" });
    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/);
    const loaded = await getCakeDesign(saved.id);
    expect(loaded.design).toEqual(saved.design);
    expect(loaded.total).toBe(4850);
  });

  it("sends the design's picture and gets back where the ERP keeps it", async () => {
    const plain = await saveCakeDesign(design(), { idempotencyKey: "k3" });
    expect(plain.previewUrl).toBeUndefined();
    const saved = await saveCakeDesign(design(), {
      idempotencyKey: "k4",
      previewPng: "iVBORw0KGgo=",
    });
    expect(saved.previewUrl).toMatch(new RegExp(`/images/cake-designs/${saved.id}\.png$`));
    expect((await getCakeDesign(saved.id)).previewUrl).toBe(saved.previewUrl);
  });

  it("prices a saved design again with today's prices", async () => {
    const saved = await saveCakeDesign(design(), { idempotencyKey: "k2" });
    patchCakeStudio(studio, { options: [{ id: option("sponge", "Chocolate"), price: 500 }] });
    const loaded = await getCakeDesign(saved.id);
    expect(loaded.lines.find((l) => l.label === "Chocolate sponge")?.price).toBe(500);
    expect(loaded.total).toBe(5050);
  });

  it("says when a design id is unknown", async () => {
    await expect(getCakeDesign("00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(
      ErpNotFoundError,
    );
  });
});
