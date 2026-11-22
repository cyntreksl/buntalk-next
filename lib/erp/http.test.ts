import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { z } from "zod";
import {
  ErpConfigError,
  ErpConflictError,
  ErpNotFoundError,
  ErpResponseError,
  ErpUnavailableError,
  ErpValidationError,
} from "./errors";
import { erpGet, erpRequest, transport } from "./http";
import { toCategory, toProduct } from "./mappers";
import { erpCategorySchema, erpProductSchema, listOf } from "./schemas";

const config = {
  baseUrl: "https://erp.test/api",
  apiKey: "secret-key",
  tenant: "buntalk",
  timeoutMs: 1000,
};

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const itemSchema = z.object({ data: z.object({ id: z.string() }) });

let fetchMock: Mock<typeof transport.fetch>;
/** Headers of a captured request, as a plain object (the client always sends one). */
const h = (init: RequestInit) => init.headers as Record<string, string>;
let sleeps: number[];
let logs: string[];
const original = { ...transport };

beforeEach(() => {
  fetchMock = vi.fn<typeof transport.fetch>();
  sleeps = [];
  logs = [];
  transport.fetch = fetchMock;
  transport.sleep = async (ms) => {
    sleeps.push(ms);
  };
  transport.log = (_level, line) => logs.push(line);
  transport.config = () => config;
});

afterEach(() => {
  Object.assign(transport, original);
});

describe("erpRequest", () => {
  it("calls the tenant storefront URL with the API key, request ID and query", async () => {
    fetchMock.mockResolvedValue(json(200, { data: { id: "a" } }));

    const result = await erpGet("/products", itemSchema, {
      category: "buns",
      page: 2,
      x: undefined,
    });

    expect(result).toEqual({ data: { id: "a" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://erp.test/api/v1/tenants/buntalk/storefront/products?category=buns&page=2",
    );
    expect(init.method).toBe("GET");
    expect(h(init).Authorization).toBe("Bearer secret-key");
    expect(h(init)["X-Request-Id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("never logs the API key or query values", async () => {
    fetchMock.mockResolvedValue(json(200, { data: { id: "a" } }));
    await erpGet("/products", itemSchema, { search: "private search" });
    expect(logs.join("\n")).not.toContain("secret-key");
    expect(logs.join("\n")).not.toContain("private search");
    expect(logs[0]).toMatch(/^\[erp\] GET \/products ok \d+ms attempt=1 id=/);
  });

  it("throws a config error when the ERP is not configured", async () => {
    transport.config = () => null;
    await expect(erpGet("/products", itemSchema)).rejects.toBeInstanceOf(ErpConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, ErpConfigError],
    [403, ErpConfigError],
    [404, ErpNotFoundError],
    [409, ErpConflictError],
    [400, ErpResponseError],
  ])("maps HTTP %i to %s without retrying", async (status, ErrorType) => {
    fetchMock.mockResolvedValue(json(status, { message: "nope" }));
    await expect(erpGet("/x", itemSchema)).rejects.toBeInstanceOf(ErrorType);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps 422 to a validation error with the ERP's field messages", async () => {
    fetchMock.mockResolvedValue(
      json(422, {
        message: "The phone field is required.",
        errors: { phone: ["The phone field is required."] },
      }),
    );
    const error = await erpRequest({
      method: "POST",
      path: "/orders",
      schema: itemSchema,
      body: {},
    })
      .then(() => null)
      .catch((e) => e);
    expect(error).toBeInstanceOf(ErpValidationError);
    expect(error.fieldErrors).toEqual({ phone: ["The phone field is required."] });
    expect(error.userMessage).toBe("The phone field is required.");
  });

  it("retries GETs on 5xx with growing back-off, then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(json(503, {}))
      .mockResolvedValueOnce(json(502, {}))
      .mockResolvedValueOnce(json(200, { data: { id: "ok" } }));

    await expect(erpGet("/x", itemSchema)).resolves.toEqual({ data: { id: "ok" } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleeps).toHaveLength(2);
    expect(sleeps[1]).toBeGreaterThan(sleeps[0]);
    // The same request ID is used for every attempt, so ERP logs can be matched.
    const ids = fetchMock.mock.calls.map(([, init]) => h(init)["X-Request-Id"]);
    expect(new Set(ids).size).toBe(1);
  });

  it("gives up after 2 retries and throws ErpUnavailableError", async () => {
    fetchMock.mockResolvedValue(json(500, {}));
    await expect(erpGet("/x", itemSchema)).rejects.toBeInstanceOf(ErpUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("treats network errors and timeouts as unavailable and retries them", async () => {
    const timeout = Object.assign(new Error("timeout"), { name: "TimeoutError" });
    fetchMock
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockRejectedValueOnce(timeout)
      .mockRejectedValueOnce(timeout);
    const error = await erpGet("/x", itemSchema).catch((e) => e);
    expect(error).toBeInstanceOf(ErpUnavailableError);
    expect(error.message).toContain("timed out after 1000ms");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("honours Retry-After on 429", async () => {
    fetchMock
      .mockResolvedValueOnce(json(429, {}, { "Retry-After": "2" }))
      .mockResolvedValueOnce(json(200, { data: { id: "ok" } }));
    await erpGet("/x", itemSchema);
    expect(sleeps).toEqual([2000]);
  });

  it("never retries writes, to avoid duplicate orders", async () => {
    fetchMock.mockResolvedValue(json(503, {}));
    await expect(
      erpRequest({
        method: "POST",
        path: "/orders",
        schema: itemSchema,
        body: { a: 1 },
        idempotencyKey: "order-123",
      }),
    ).rejects.toBeInstanceOf(ErpUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(h(init)["Idempotency-Key"]).toBe("order-123");
    expect(init.body).toBe('{"a":1}');
  });

  it("retries a read-only POST (price quote) like a GET", async () => {
    fetchMock
      .mockResolvedValueOnce(json(503, {}))
      .mockResolvedValueOnce(json(200, { data: { id: "ok" } }));
    await erpRequest({ method: "POST", path: "/prices/quote", schema: itemSchema, readOnly: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects responses that don't match the agreed shape", async () => {
    fetchMock.mockResolvedValue(json(200, { data: { id: 42 } }));
    const error = await erpGet("/x", itemSchema).catch((e) => e);
    expect(error).toBeInstanceOf(ErpResponseError);
    expect(error.message).toContain("data.id");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects bodies that aren't JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>oops</html>", { status: 200 }));
    await expect(erpGet("/x", itemSchema)).rejects.toBeInstanceOf(ErpResponseError);
  });
});

describe("product schema and mapper", () => {
  const wireProduct = {
    link_id: "9b1d…",
    code: "FB-01",
    slug: "fish-bun",
    name: "Fish bun",
    description: null,
    category: { link_id: "c1", slug: "buns", name: "Buns" },
    is_active: true,
    price: {
      currency: "LKR",
      selling_price: "120.00",
      printed_price: "150.00",
      compare_at_price: "150.00",
    },
    skus: [
      {
        link_id: "s1",
        code: "FB-01-S",
        options: [{ type: "Size", value: "Small" }],
        base_quantity: "1.0000",
        is_active: true,
        price: { currency: "LKR", selling_price: "120.00", printed_price: null },
      },
      {
        link_id: "s2",
        code: "FB-01-OLD",
        base_quantity: "1",
        is_active: false,
        price: { currency: "LKR", selling_price: "100.00", printed_price: null },
      },
    ],
  };

  it("turns ERP decimal strings into numbers and storefront field names", () => {
    const { data } = listOf(erpProductSchema).parse({ data: [wireProduct] });
    const product = toProduct(data[0]);
    expect(product).toMatchObject({
      id: "9b1d…",
      slug: "fish-bun",
      name: "Fish bun",
      description: "",
      price: 120,
      compareAtPrice: 150,
      printedPrice: 150,
      currency: "LKR",
      categorySlug: "buns",
      featured: false,
      imageUrls: [],
    });
    // Inactive SKUs are dropped.
    expect(product.skus).toEqual([
      {
        id: "s1",
        code: "FB-01-S",
        options: [{ type: "Size", value: "Small" }],
        price: 120,
        compareAtPrice: undefined,
        inStock: true,
      },
    ]);
  });

  it("ignores a compare-at price that isn't higher than the selling price", () => {
    const product = toProduct(
      erpProductSchema.parse({
        ...wireProduct,
        price: { ...wireProduct.price, compare_at_price: "100.00" },
      }),
    );
    expect(product.compareAtPrice).toBeUndefined();
  });
});

describe("catalog sync mapping (BUN-160)", () => {
  const base = {
    link_id: "p1",
    code: "CK-01",
    slug: "chocolate-cake",
    name: "Chocolate cake",
    description: "Rich and moist.",
    category: { link_id: "c2", slug: "birthday", name: "Birthday" },
    is_active: true,
    price: { currency: "LKR", selling_price: "3500.00", printed_price: null },
  };

  it("maps image, gallery, attributes and processing time", () => {
    const product = toProduct(
      erpProductSchema.parse({
        ...base,
        image_url: "https://cdn.erp.test/p1.jpg",
        gallery_urls: ["https://cdn.erp.test/p1-b.jpg", "https://cdn.erp.test/p1.jpg"],
        attributes: [
          { name: "Size", values: ["1 kg", "2 kg"] },
          { name: "Empty", values: [] },
        ],
        processing_time_hours: 24,
      }),
    );
    expect(product.code).toBe("CK-01");
    // Main image first, duplicates removed.
    expect(product.imageUrls).toEqual([
      "https://cdn.erp.test/p1.jpg",
      "https://cdn.erp.test/p1-b.jpg",
    ]);
    // Options without values are dropped.
    expect(product.attributes).toEqual([{ name: "Size", values: ["1 kg", "2 kg"] }]);
    expect(product.processingTimeHours).toBe(24);
  });

  it("treats a missing or broken image URL as no image instead of failing the product", () => {
    const noImage = toProduct(erpProductSchema.parse({ ...base, image_url: null }));
    expect(noImage.imageUrls).toEqual([]);

    const broken = toProduct(
      erpProductSchema.parse({
        ...base,
        image_url: "not a url",
        gallery_urls: ["/storage/relative.jpg", "javascript:alert(1)"],
      }),
    );
    expect(broken.imageUrls).toEqual([]);
    expect(broken.processingTimeHours).toBeUndefined();
  });

  it("maps category parent and sort order", () => {
    const category = toCategory(
      erpCategorySchema.parse({
        link_id: "c2",
        slug: "birthday",
        name: "Birthday",
        parent_link_id: "c1",
        sort_order: 4,
        is_active: true,
      }),
    );
    expect(category).toMatchObject({ id: "c2", parentId: "c1", sortOrder: 4, description: "" });
  });
});
