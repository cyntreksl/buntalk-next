import { beforeEach, describe, expect, it, vi } from "vitest";

const quoteCakeDesign = vi.fn();
const saveCakeDesign = vi.fn();
const getCakeDesign = vi.fn();
vi.mock("@/lib/auth", () => ({ getCustomerId: async () => null }));
vi.mock("@/lib/erp", async () => {
  const errors = await import("@/lib/erp/errors");
  const { cakeDesignSchema } = await import("@/lib/erp/cake-studio");
  return {
    ...errors,
    cakeDesignSchema,
    quoteCakeDesign: (...a: unknown[]) => quoteCakeDesign(...a),
    saveCakeDesign: (...a: unknown[]) => saveCakeDesign(...a),
    getCakeDesign: (...a: unknown[]) => getCakeDesign(...a),
  };
});
vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));

const { ErpNotFoundError, ErpUnavailableError, ErpValidationError } = await import("@/lib/erp");
const quoteRoute = await import("./quote/route");
const designsRoute = await import("./designs/route");
const designRoute = await import("./designs/[id]/route");

const design = { size_id: 1, shape_id: 1, sponge_id: 2, frosting_id: 3, finish_id: 4 };
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://x", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
const quote = {
  design,
  lines: [{ label: "1 kg round cake", price: 3900 }],
  total: 3900,
  summary: [],
};

beforeEach(() => {
  quoteCakeDesign.mockReset();
  saveCakeDesign.mockReset();
  getCakeDesign.mockReset();
});

describe("POST /api/cake-studio/quote", () => {
  it("asks the ERP to price the design and ignores prices sent by the browser", async () => {
    quoteCakeDesign.mockResolvedValue(quote);
    const res = await quoteRoute.POST(post({ design: { ...design, price: 1 }, total: 1 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(quote);
    // Unknown fields (a price) never reach the ERP.
    expect(quoteCakeDesign.mock.calls[0][0]).toEqual(design);
  });

  it("returns the ERP's message per field for a design it refuses", async () => {
    quoteCakeDesign.mockRejectedValue(
      new ErpValidationError("Choose a sponge.", { sponge_id: ["Choose a sponge."] }, "/x"),
    );
    const res = await quoteRoute.POST(post({ design }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ fieldErrors: { sponge_id: "Choose a sponge." } });
  });

  it("refuses something that isn't a design, and says when the ERP is down", async () => {
    expect((await quoteRoute.POST(post({ design: { size_id: "x" } }))).status).toBe(400);
    quoteCakeDesign.mockRejectedValue(new ErpUnavailableError("down", "/x"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await quoteRoute.POST(post({ design }))).status).toBe(503);
  });
});

describe("saved designs", () => {
  it("saves with the browser's idempotency key, so a retry saves once", async () => {
    saveCakeDesign.mockResolvedValue({ ...quote, id: "d-1" });
    const res = await designsRoute.POST(post({ design }, { "Idempotency-Key": "abc12345" }));
    expect(res.status).toBe(201);
    expect(saveCakeDesign.mock.calls[0][1]).toMatchObject({
      idempotencyKey: "cake-design:abc12345",
    });
  });

  it("loads a design by its id, and 404s for an unknown or malformed id", async () => {
    getCakeDesign.mockResolvedValue({ ...quote, id: "d-1" });
    const ok = await designRoute.GET(new Request("http://x"), {
      params: Promise.resolve({ id: "d-1" }),
    });
    expect(ok.status).toBe(200);
    getCakeDesign.mockRejectedValue(new ErpNotFoundError("/x"));
    const missing = await designRoute.GET(new Request("http://x"), {
      params: Promise.resolve({ id: "nope" }),
    });
    expect(missing.status).toBe(404);
    const bad = await designRoute.GET(new Request("http://x"), {
      params: Promise.resolve({ id: "../etc" }),
    });
    expect(bad.status).toBe(404);
  });
});
