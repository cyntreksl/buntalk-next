import type { CakeLook, CakeView } from "@/features/cake-studio/scene/CakeScene";
import type {
  CakeFinishStyle,
  CakeShapeModel,
  CakeTier,
  CakeToppingStyle,
} from "@/features/cake-studio/scene/types";
import type { CakeDesign } from "@/lib/erp";
import type { Menu } from "./design";

/**
 * What the 3D cake shows for a design (BUN-182): the design's picks turned
 * into shapes, colours and styles. Ported from the ERP Cake Studio page
 * (tiersFor, the look it builds, guessStyle; deck heights as CakeSize::deckHeightsCm)
 * so the storefront and the ERP draw the same cake.
 */

const FALLBACK_TIER: CakeTier = { width: 2.4, height: 0.9 };
const TOPPING_COLOURS = ["#B8174C", "#F2D488", "#7A4B2A", "#FFFFFF", "#5B8C3A"];
const DEFAULT_FROSTING = "#FFF8EC";
const DEFAULT_SPONGE = "#F3D9A4";
const DEFAULT_DRIP = "#4A2A1A";
const DEFAULT_WRITING = "#2A1810";

const MODELS: CakeShapeModel[] = ["round", "square", "heart"];
const FINISHES: CakeFinishStyle[] = ["smooth", "piped", "drip", "ombre"];
const TOPPINGS: CakeToppingStyle[] = [
  "fruit",
  "sprinkles",
  "macarons",
  "pearls",
  "candles",
  "flowers",
  "pieces",
];

/** A style from an option's name, when the ERP hasn't set one ("Fresh berries" → fruit). */
export function guessStyle(name: string): string | null {
  const lower = name.toLowerCase();
  const guesses: [string, string][] = [
    ["drip", "drip"],
    ["pipe", "piped"],
    ["ombre", "ombre"],
    ["fruit", "fruit"],
    ["berr", "fruit"],
    ["sprinkle", "sprinkles"],
    ["macaron", "macarons"],
    ["pearl", "pearls"],
    ["candle", "candles"],
    ["flower", "flowers"],
    ["bold", "bold"],
  ];
  return guesses.find(([word]) => lower.includes(word))?.[1] ?? null;
}

/** Each deck's height in cm: the size's own decks, else shrinking a little per deck (as the ERP). */
export function deckHeightsCm(tiers: CakeTier[], count: number): number[] {
  if (count === tiers.length) return tiers.map((t) => Math.round(t.height * 10));
  const bottom = tiers[0]?.height ?? 0.9;
  return Array.from({ length: Math.max(1, count) }, (_, i) =>
    Math.round(Math.max(0.5, bottom * (1 - 0.06 * i)) * 10),
  );
}

/** The decks the 3D cake stands on: the size's own widths, else narrowing up from the bottom deck. */
export function tiersFor(
  own: CakeTier[] | undefined,
  count: number,
  heights: number[],
): CakeTier[] {
  const tiers = own && own.length > 0 ? own : [FALLBACK_TIER];
  const bottom = tiers[0];
  const top = Math.max(0.7, bottom.width * 0.45);
  return Array.from({ length: count }, (_, index) => {
    const share = count === 1 ? 0 : index / (count - 1);
    return {
      width:
        count === tiers.length
          ? tiers[index].width
          : Number((bottom.width - (bottom.width - top) * share).toFixed(2)),
      height: (heights[index] ?? 9) / 10,
    };
  });
}

export function lookFor(
  menu: Menu,
  design: CakeDesign,
  options: { view?: CakeView; spinning?: boolean; glow?: boolean } = {},
): CakeLook {
  const option = (kind: keyof Menu["options"], id?: number | null) =>
    id == null ? undefined : menu.options[kind].find((o) => o.id === id);
  const size = menu.sizes.find((s) => s.id === design.size_id);
  const shape = menu.shapes.find((s) => s.id === design.shape_id);
  const count = Math.max(1, design.tier_count ?? size?.tiers.length ?? 1);
  const heights =
    design.deck_heights && design.deck_heights.length === count
      ? design.deck_heights
      : deckHeightsCm(size?.tiers ?? [], count);
  const sponge = option("sponge", design.sponge_id);
  const finish = option("finish", design.finish_id);
  const finishStyle = finish?.style ?? guessStyle(finish?.name ?? "") ?? "smooth";
  const toppings = (design.topping_ids ?? [])
    .map((id) => option("topping", id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const counted = toppings.find((t) => t.maxCount);
  const lettering = option("lettering", design.lettering_id);
  const view = options.view ?? "front";

  return {
    model: MODELS.includes(shape?.model as CakeShapeModel)
      ? (shape!.model as CakeShapeModel)
      : "round",
    tiers: tiersFor(size?.tiers, count, heights),
    frosting: option("frosting", design.frosting_id)?.colour ?? DEFAULT_FROSTING,
    spongeLayers: sponge?.layerColours?.length ? sponge.layerColours : [DEFAULT_SPONGE],
    filling: option("filling", design.filling_id)?.colour ?? null,
    finish: FINISHES.includes(finishStyle as CakeFinishStyle)
      ? (finishStyle as CakeFinishStyle)
      : "smooth",
    drip:
      finishStyle === "drip" || finish?.needsDrip
        ? (option("drip", design.drip_id)?.colour ?? DEFAULT_DRIP)
        : null,
    toppings: toppings
      .filter((t) => t !== counted)
      .map((t, index) => {
        const style = t.style ?? guessStyle(t.name) ?? "pieces";
        return {
          style: TOPPINGS.includes(style as CakeToppingStyle)
            ? (style as CakeToppingStyle)
            : "pieces",
          colour: t.colour ?? TOPPING_COLOURS[index % TOPPING_COLOURS.length],
        };
      }),
    candles: counted ? (design.candle_count ?? 1) : 0,
    topper:
      (design.extras ?? []).includes("number_topper") && design.topper_number
        ? design.topper_number
        : null,
    message: (design.message ?? "").trim(),
    lettering:
      (lettering?.style ?? guessStyle(lettering?.name ?? "")) === "bold" ? "bold" : "script",
    writing: option("writing_colour", design.writing_colour_id)?.colour ?? DEFAULT_WRITING,
    // The photo print needs the customer's photo upload (not in the storefront yet).
    photo: null,
    view,
    spinning: options.spinning ?? false,
    glow: options.glow ?? false,
  };
}
