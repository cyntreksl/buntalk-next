import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { cacheTags } from "@/lib/cache-tags";
import { erpGet, erpRequest } from "./http";
import { one } from "./schemas";

/**
 * Cake Studio data from the ERP (BUN-179; ERP side: ticket BUN-260).
 *
 * The ERP owns the whole Cake Studio: the menu (sizes, shapes, sponges,
 * fillings, frostings, finishes, drips, toppings, writing colours, lettering,
 * extras, occasions, favourites, rules), the prices (and B2B price levels),
 * checking a design and pricing it. The storefront shows the menu and asks
 * the ERP to price every design; it never calculates a cake price itself.
 *
 * - getCakeStudioMenu(): cached ("catalog" profile, tag `cake-studio`, refreshed
 *   by the ERP's `{ "type": "cake_studio" }` webhook).
 * - quoteCakeDesign(), saveCakeDesign(), getCakeDesign(): live, never cached.
 */

const money = z.union([z.string().regex(/^-?\d+(\.\d+)?$/), z.number()]).transform(Number);
const id = z.number().int().positive();
const colour = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable()
  .optional()
  .catch(null);

export const CAKE_OPTION_KINDS = [
  "sponge",
  "filling",
  "frosting",
  "finish",
  "drip",
  "topping",
  "writing_colour",
  "lettering",
  "extra",
] as const;
export type CakeOptionKind = (typeof CAKE_OPTION_KINDS)[number];

const erpCakeOptionSchema = z.object({
  id,
  code: z.string().nullable().optional(),
  name: z.string(),
  price: money,
  colour,
  layer_colours: z.array(z.string()).nullable().optional(),
  max_count: z.number().int().positive().nullable().optional(),
  needs_drip: z.boolean().default(false),
  /** 3D look: "smooth", "drip", "sprinkles", "script" … (BUN-182). */
  style: z.string().nullable().optional(),
});

const erpCakeMenuSchema = z.object({
  sizes: z.array(
    z.object({
      id,
      name: z.string(),
      weight_kg: money,
      /** Each tier's width and height for the 3D cake, bottom first. */
      tiers: z.array(z.object({ width: z.number(), height: z.number() })),
      serves_min: z.number().int(),
      serves_max: z.number().int(),
      /** Price of this size in each shape it's made in: shape id → price. */
      shape_prices: z.record(z.string(), money),
      /** Earliest date it can be ready (YYYY-MM-DD). */
      earliest: z.string(),
    }),
  ),
  shapes: z.array(z.object({ id, name: z.string(), model: z.string() })),
  options: z
    .record(z.string(), z.array(erpCakeOptionSchema))
    .transform(
      (byKind) =>
        Object.fromEntries(CAKE_OPTION_KINDS.map((k) => [k, byKind[k] ?? []])) as Record<
          CakeOptionKind,
          z.infer<typeof erpCakeOptionSchema>[]
        >,
    ),
  occasions: z.array(z.object({ id, name: z.string(), messages: z.array(z.string()) })),
  favourites: z.array(
    z.object({
      id,
      name: z.string(),
      occasion_ids: z.array(z.number().int()),
      config: z.record(z.string(), z.unknown()),
    }),
  ),
  rules: z.object({
    is_open: z.boolean(),
    message_max: z.number().int(),
    photo_max_kb: z.number().int(),
    deck_prices: z.record(z.string(), money).default({}),
    deck_height_min_cm: z.number().int().optional(),
    deck_height_max_cm: z.number().int().optional(),
    height_cm_price: money.optional(),
    welcome: z.string().nullable().optional(),
  }),
});

/** The picks that make a design (what the customer chose). Ids are the ERP's. */
export const cakeDesignSchema = z.object({
  size_id: id,
  tier_count: z.number().int().min(1).max(5).nullable().optional(),
  deck_heights: z.array(z.number().int().min(1).max(60)).max(5).nullable().optional(),
  shape_id: id,
  sponge_id: id,
  filling_id: id.nullable().optional(),
  frosting_id: id,
  finish_id: id,
  drip_id: id.nullable().optional(),
  topping_ids: z.array(id).max(20).nullable().optional(),
  candle_count: z.number().int().min(1).max(200).nullable().optional(),
  /** eggless | less_sugar | number_topper | photo_print */
  extras: z.array(z.string().max(30)).max(10).nullable().optional(),
  topper_number: z.string().max(3).nullable().optional(),
  message: z.string().max(120).nullable().optional(),
  lettering_id: id.nullable().optional(),
  writing_colour_id: id.nullable().optional(),
  occasion_id: id.nullable().optional(),
});
export type CakeDesign = z.infer<typeof cakeDesignSchema>;

const erpCakeQuoteSchema = z.object({
  /** The design as the ERP checked it (defaults filled in, unknown picks removed). */
  design: cakeDesignSchema.passthrough(),
  lines: z.array(z.object({ label: z.string(), price: money })),
  total: money,
  summary: z.array(z.object({ label: z.string(), value: z.string() })),
  earliest_date: z.string().nullable().optional(),
});
const erpSavedDesignSchema = erpCakeQuoteSchema.extend({
  id: z.string().min(1),
  created_at: z.string().nullable().optional(),
});

export type CakeStudioMenu = {
  sizes: {
    id: number;
    name: string;
    weightKg: number;
    tiers: { width: number; height: number }[];
    servesMin: number;
    servesMax: number;
    /** shape id → price of this size in that shape. */
    shapePrices: Record<string, number>;
    /** Lowest price of this size in any shape ("From …"). */
    fromPrice: number;
    earliest: string;
  }[];
  shapes: { id: number; name: string; model: string }[];
  options: Record<
    CakeOptionKind,
    {
      id: number;
      code?: string;
      name: string;
      price: number;
      colour?: string;
      layerColours?: string[];
      maxCount?: number;
      needsDrip: boolean;
      style?: string;
    }[]
  >;
  occasions: { id: number; name: string; messages: string[] }[];
  favourites: {
    id: number;
    name: string;
    occasionIds: number[];
    config: Record<string, unknown>;
  }[];
  rules: {
    isOpen: boolean;
    messageMax: number;
    photoMaxKb: number;
    deckPrices: Record<string, number>;
    deckHeightMinCm?: number;
    deckHeightMaxCm?: number;
    heightCmPrice?: number;
    welcome?: string;
  };
};

export type CakeQuote = {
  design: CakeDesign;
  lines: { label: string; price: number }[];
  total: number;
  summary: { label: string; value: string }[];
  earliestDate?: string;
};

export type SavedCakeDesign = CakeQuote & { id: string; createdAt?: string };

const orUndefined = <T>(v: T | null | undefined): T | undefined => v ?? undefined;

export function toCakeStudioMenu(m: z.infer<typeof erpCakeMenuSchema>): CakeStudioMenu {
  return {
    sizes: m.sizes.map((s) => {
      const prices = Object.values(s.shape_prices);
      return {
        id: s.id,
        name: s.name,
        weightKg: s.weight_kg,
        tiers: s.tiers,
        servesMin: s.serves_min,
        servesMax: s.serves_max,
        shapePrices: s.shape_prices,
        fromPrice: prices.length > 0 ? Math.min(...prices) : 0,
        earliest: s.earliest,
      };
    }),
    shapes: m.shapes,
    options: Object.fromEntries(
      CAKE_OPTION_KINDS.map((kind) => [
        kind,
        m.options[kind].map((o) => ({
          id: o.id,
          code: orUndefined(o.code),
          name: o.name,
          price: o.price,
          colour: orUndefined(o.colour),
          layerColours: orUndefined(o.layer_colours),
          maxCount: orUndefined(o.max_count),
          needsDrip: o.needs_drip,
          style: orUndefined(o.style),
        })),
      ]),
    ) as CakeStudioMenu["options"],
    occasions: m.occasions,
    favourites: m.favourites.map((f) => ({
      id: f.id,
      name: f.name,
      occasionIds: f.occasion_ids,
      config: f.config,
    })),
    rules: {
      isOpen: m.rules.is_open,
      messageMax: m.rules.message_max,
      photoMaxKb: m.rules.photo_max_kb,
      deckPrices: m.rules.deck_prices,
      deckHeightMinCm: m.rules.deck_height_min_cm,
      deckHeightMaxCm: m.rules.deck_height_max_cm,
      heightCmPrice: m.rules.height_cm_price,
      welcome: orUndefined(m.rules.welcome),
    },
  };
}

const toQuote = (q: z.infer<typeof erpCakeQuoteSchema>): CakeQuote => ({
  design: cakeDesignSchema.parse(q.design),
  lines: q.lines,
  total: q.total,
  summary: q.summary,
  earliestDate: orUndefined(q.earliest_date),
});

/** The Cake Studio menu at the online (customer) prices. Cached; refreshed by the ERP's webhook. */
export async function getCakeStudioMenu(): Promise<CakeStudioMenu> {
  "use cache";
  cacheLife("catalog");
  cacheTag(cacheTags.catalog, cacheTags.cakeStudio);

  const { data } = await erpGet("/cake-studio/menu", one(erpCakeMenuSchema));
  return toCakeStudioMenu(data);
}

/**
 * Checks and prices a design with the ERP (live). Invalid picks throw
 * ErpValidationError with the ERP's message per field ("Choose a sponge.").
 */
export async function quoteCakeDesign(
  design: CakeDesign,
  options: { customerId?: string | null } = {},
): Promise<CakeQuote> {
  const { data } = await erpRequest({
    method: "POST",
    path: "/cake-studio/quote",
    readOnly: true,
    schema: one(erpCakeQuoteSchema),
    body: { design, customer: options.customerId ?? null },
  });
  return toQuote(data);
}

/** Saves a design in the ERP and returns its id (a saved design never changes). */
export async function saveCakeDesign(
  design: CakeDesign,
  options: { customerId?: string | null; idempotencyKey: string },
): Promise<SavedCakeDesign> {
  const { data } = await erpRequest({
    method: "POST",
    path: "/cake-studio/designs",
    schema: one(erpSavedDesignSchema),
    idempotencyKey: options.idempotencyKey,
    body: { design, customer: options.customerId ?? null },
  });
  return { ...toQuote(data), id: data.id, createdAt: orUndefined(data.created_at) };
}

/**
 * A saved design by its id, priced again now (today's menu and prices).
 * Throws ErpNotFoundError for an unknown id.
 */
export async function getCakeDesign(
  designId: string,
  options: { customerId?: string | null } = {},
): Promise<SavedCakeDesign> {
  const { data } = await erpGet(
    `/cake-studio/designs/${encodeURIComponent(designId)}`,
    one(erpSavedDesignSchema),
    options.customerId ? { customer: options.customerId } : undefined,
  );
  return { ...toQuote(data), id: data.id, createdAt: orUndefined(data.created_at) };
}
