import type { CakeDesign } from "@/lib/erp";
import { cakeDesignSchema } from "./design-schema";
import { applyChange, type Menu } from "./design";

/**
 * The design being worked on, kept in the browser (BUN-183) so a refresh or a
 * closed tab doesn't lose it. One draft per starting point (a new cake, a
 * product's cake, a saved design, a favourite), for 14 days. The draft is
 * only a convenience: it is checked against today's menu when it is read, and
 * the ERP prices it again like any design.
 */

export const DRAFT_DAYS = 14;
const PREFIX = "buntalk:cake-studio:draft:v1:";

/** Where a designer started from, which names its draft. */
export function draftKey(start: {
  designId?: string;
  favouriteId?: number;
  sizeId?: number;
}): string {
  if (start.designId) return `${PREFIX}design-${start.designId}`;
  if (start.favouriteId) return `${PREFIX}favourite-${start.favouriteId}`;
  if (start.sizeId) return `${PREFIX}size-${start.sizeId}`;
  return `${PREFIX}new`;
}

type Stored = { design: CakeDesign; savedAt: number };

/** The stored text of a draft ("" when there is none or storage is blocked). */
export function readDraftText(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function writeDraft(key: string, design: CakeDesign, now = Date.now()): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ design, savedAt: now } satisfies Stored));
  } catch {
    // Private mode or full storage: the design just isn't kept.
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

/**
 * A stored draft turned back into a design that today's menu can make, or
 * null: too old, not a design, or a size, shape or option that is no longer
 * on the menu. What depends on other picks is tidied as in the designer.
 */
export function parseDraft(text: string, menu: Menu, now = Date.now()): CakeDesign | null {
  if (!text) return null;
  let stored: Partial<Stored>;
  try {
    stored = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof stored?.savedAt !== "number" || now - stored.savedAt > DRAFT_DAYS * 86_400_000) {
    return null;
  }
  const parsed = cakeDesignSchema.safeParse(stored.design);
  if (!parsed.success) return null;
  const design = parsed.data;

  const has = (kind: keyof Menu["options"], id?: number | null) =>
    id == null || menu.options[kind].some((o) => o.id === id);
  const size = menu.sizes.find((s) => s.id === design.size_id);
  if (
    !size ||
    !menu.shapes.some((s) => s.id === design.shape_id) ||
    !(String(design.shape_id) in size.shapePrices) ||
    !has("sponge", design.sponge_id) ||
    !has("filling", design.filling_id) ||
    !has("frosting", design.frosting_id) ||
    !has("finish", design.finish_id)
  ) {
    return null;
  }
  // Toppings, extras and message options that went away are dropped rather than losing the draft.
  return applyChange(menu, design, {
    topping_ids: (design.topping_ids ?? []).filter((id) => has("topping", id)),
    extras: (design.extras ?? []).filter((c) => menu.options.extra.some((x) => x.code === c)),
    drip_id: has("drip", design.drip_id) ? design.drip_id : null,
    lettering_id: has("lettering", design.lettering_id) ? design.lettering_id : null,
    writing_colour_id: has("writing_colour", design.writing_colour_id)
      ? design.writing_colour_id
      : null,
    occasion_id: menu.occasions.some((o) => o.id === design.occasion_id)
      ? design.occasion_id
      : null,
  });
}

/** "Friday 27 November" for an ERP date (YYYY-MM-DD), read as a calendar day. */
export function readyDateText(date: string, locale = "en-GB"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!m) return date;
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))));
}

/** "2 days'", "a day's", "12 hours'" notice, from the ERP's notice hours. */
export function noticeText(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "a day's" : `${days} days'`;
  }
  return hours === 1 ? "an hour's" : `${hours} hours'`;
}
