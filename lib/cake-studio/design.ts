import type { CakeDesign, CakeStudioMenu } from "@/lib/erp";

/**
 * Cake Studio design rules for the storefront designer (BUN-181). Pure, used
 * in the browser. They come from the ERP's menu: which shapes each size is
 * made in, which finishes need a drip, the candle limit, the message length,
 * the extra-deck prices. The ERP checks and prices every design again
 * (quote); these rules only make sure customers can't pick what the ERP
 * would refuse, and explain why.
 */

export type Menu = Pick<CakeStudioMenu, "sizes" | "shapes" | "options" | "occasions" | "rules">;

export const MAX_DECKS = 5;
export const NUMBER_TOPPER = "number_topper";

/** A first design: the given (or first) size, its cheapest shape, and the first of each required option. */
export function startingDesign(menu: Menu, sizeId?: number): CakeDesign {
  const size = menu.sizes.find((s) => s.id === sizeId) ?? menu.sizes[0];
  const cheapestShape = Object.entries(size?.shapePrices ?? {}).sort((a, b) => a[1] - b[1])[0];
  const first = (kind: keyof Menu["options"]) => menu.options[kind][0]?.id;
  return {
    size_id: size?.id ?? 0,
    tier_count: size?.tiers.length ?? 1,
    shape_id: cheapestShape ? Number(cheapestShape[0]) : (menu.shapes[0]?.id ?? 0),
    sponge_id: first("sponge") ?? 0,
    filling_id: null,
    frosting_id: first("frosting") ?? 0,
    finish_id: first("finish") ?? 0,
    drip_id: null,
    topping_ids: [],
    candle_count: null,
    extras: [],
    topper_number: null,
    message: "",
    lettering_id: null,
    writing_colour_id: null,
    occasion_id: null,
  };
}

/** Why a shape can't be chosen with the current size, or null. */
export function shapeProblem(menu: Menu, design: CakeDesign, shapeId: number): string | null {
  const size = menu.sizes.find((s) => s.id === design.size_id);
  const shape = menu.shapes.find((s) => s.id === shapeId);
  if (size && shape && !(String(shapeId) in size.shapePrices)) {
    return `A ${size.name} cake isn't made ${shape.name.toLowerCase()}.`;
  }
  return null;
}

/** Why a size can't be chosen with the current shape, or null. */
export function sizeProblem(menu: Menu, design: CakeDesign, sizeId: number): string | null {
  const size = menu.sizes.find((s) => s.id === sizeId);
  const shape = menu.shapes.find((s) => s.id === design.shape_id);
  if (size && shape && !(String(shape.id) in size.shapePrices)) {
    return `Not made ${shape.name.toLowerCase()}.`;
  }
  return null;
}

/** Price of a size in the chosen shape (the ERP's), or undefined when it isn't made that way. */
export const sizePrice = (menu: Menu, sizeId: number, shapeId: number) =>
  menu.sizes.find((s) => s.id === sizeId)?.shapePrices[String(shapeId)];

/**
 * What choosing this shape adds or saves compared with the current one, at the
 * current size (e.g. +250 for heart). Null when it isn't made that way.
 */
export function shapeImpact(menu: Menu, design: CakeDesign, shapeId: number): number | null {
  const now = sizePrice(menu, design.size_id, design.shape_id);
  const then = sizePrice(menu, design.size_id, shapeId);
  return now === undefined || then === undefined ? null : then - now;
}

/** The extra-deck prices for a size: decks beyond the size's own tiers cost the ERP's deck price. */
export function deckImpact(menu: Menu, sizeId: number, deckCount: number): number {
  const size = menu.sizes.find((s) => s.id === sizeId);
  const own = size?.tiers.length ?? 1;
  let total = 0;
  for (let deck = own + 1; deck <= deckCount; deck++)
    total += menu.rules.deckPrices[String(deck)] ?? 0;
  return total;
}

/** Deck counts the customer can choose for a size: its own, plus priced extra decks. */
export function deckChoices(menu: Menu, sizeId: number): number[] {
  const own = menu.sizes.find((s) => s.id === sizeId)?.tiers.length ?? 1;
  const choices = [own];
  for (let deck = own + 1; deck <= MAX_DECKS && String(deck) in menu.rules.deckPrices; deck++) {
    choices.push(deck);
  }
  return choices;
}

const optionById = (menu: Menu, kind: keyof Menu["options"], id: number | null | undefined) =>
  id == null ? undefined : menu.options[kind].find((o) => o.id === id);

/**
 * Applies a change and tidies what depends on it, so the design is always
 * one the ERP accepts:
 * - a size that isn't made in the shape: the shape moves to the cheapest one it is made in;
 * - a size change resets the decks to that size's own;
 * - a finish without a drip clears the drip; one that needs it picks the first drip;
 * - no candles: no candle count; candles: at least 1, at most their limit;
 * - no number topper: no topper number;
 * - no message: no lettering or writing colour; a message gets the first of each.
 */
export function applyChange(
  menu: Menu,
  design: CakeDesign,
  change: Partial<CakeDesign>,
): CakeDesign {
  const next: CakeDesign = { ...design, ...change };

  if (change.size_id !== undefined && change.size_id !== design.size_id) {
    const size = menu.sizes.find((s) => s.id === next.size_id);
    next.tier_count = size?.tiers.length ?? 1;
    if (size && !(String(next.shape_id) in size.shapePrices)) {
      const cheapest = Object.entries(size.shapePrices).sort((a, b) => a[1] - b[1])[0];
      if (cheapest) next.shape_id = Number(cheapest[0]);
    }
  }

  const finish = optionById(menu, "finish", next.finish_id);
  if (!finish?.needsDrip) next.drip_id = null;
  else if (!optionById(menu, "drip", next.drip_id)) next.drip_id = menu.options.drip[0]?.id ?? null;

  const counted = (next.topping_ids ?? [])
    .map((id) => optionById(menu, "topping", id))
    .find((t) => t?.maxCount);
  next.candle_count = counted
    ? Math.min(counted.maxCount!, Math.max(1, next.candle_count ?? 1))
    : null;

  if (!(next.extras ?? []).includes(NUMBER_TOPPER)) next.topper_number = null;

  const message = (next.message ?? "").slice(0, menu.rules.messageMax);
  next.message = message;
  if (message.trim() === "") {
    next.lettering_id = null;
    next.writing_colour_id = null;
  } else {
    next.lettering_id ??= menu.options.lettering[0]?.id ?? null;
    next.writing_colour_id ??= menu.options.writing_colour[0]?.id ?? null;
  }
  return next;
}

/** Problems the ERP would refuse, by field, checked before asking it (the ERP checks again). */
export function designProblems(menu: Menu, design: CakeDesign): Record<string, string> {
  const problems: Record<string, string> = {};
  const shapeIssue = shapeProblem(menu, design, design.shape_id);
  if (shapeIssue) problems.shape_id = shapeIssue;
  const finish = optionById(menu, "finish", design.finish_id);
  if (finish?.needsDrip && !optionById(menu, "drip", design.drip_id)) {
    problems.drip_id = "Choose a drip flavour.";
  }
  if (
    (design.extras ?? []).includes(NUMBER_TOPPER) &&
    !/^\d{1,3}$/.test(design.topper_number ?? "")
  ) {
    problems.topper_number = "Give the number for the topper, up to 3 digits.";
  }
  if ((design.message ?? "").length > menu.rules.messageMax) {
    problems.message = `Keep the message to ${menu.rules.messageMax} letters.`;
  }
  return problems;
}

/** Undo history: the last 30 designs. */
export const HISTORY_LIMIT = 30;
export function pushHistory(history: CakeDesign[], design: CakeDesign): CakeDesign[] {
  return [...history, design].slice(-HISTORY_LIMIT);
}
