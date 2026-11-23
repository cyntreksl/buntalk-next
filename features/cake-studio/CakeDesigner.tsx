"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Button, Card, Spinner } from "@/components/ui";
import {
  applyChange,
  deckChoices,
  deckImpact,
  designProblems,
  NUMBER_TOPPER,
  pushHistory,
  shapeImpact,
  shapeProblem,
  sizePrice,
  sizeProblem,
  type Menu,
} from "@/lib/cake-studio/design";
import {
  clearDraft,
  noticeText,
  parseDraft,
  readDraftText,
  readyDateText,
  writeDraft,
} from "@/lib/cake-studio/draft";
import type { CakeDesign, CakeQuote } from "@/lib/erp";
import { cx, formatPrice } from "@/lib/utils";
import { useCartStore } from "@/features/cart/store";
import { useAddToCart } from "@/features/cart/useAddToCart";
import { Cake3D, shrinkPng } from "./Cake3D";
import type { CakeGrab, CakeView } from "./scene/CakeScene";

const LKR = (n: number) => formatPrice(n, "LKR");
const impact = (n: number | null | undefined) =>
  n == null ? null : n === 0 ? "Included" : `${n > 0 ? "+" : "−"}${LKR(Math.abs(n))}`;

/** A price older than this is asked for again when the customer comes back to the tab. */
const QUOTE_FRESH_MS = 10 * 60_000;

type QuoteState =
  | { status: "loading" }
  | { status: "ready"; quote: CakeQuote; at: number }
  | { status: "invalid"; message: string; fieldErrors: Record<string, string> }
  | { status: "error"; message: string };

type Choice = {
  value: number | string;
  label: string;
  /** Price (or price impact) shown under the label. */
  note?: string | null;
  colours?: string[];
  /** Why it can't be chosen; shown and read out. */
  disabledReason?: string | null;
};

/** One choice among cards (native radios, so arrow keys and screen readers work). */
function ChoiceCards({
  name,
  legend,
  choices,
  value,
  onChange,
  error,
}: {
  name: string;
  legend: string;
  choices: Choice[];
  value: number | string | null | undefined;
  onChange: (value: number | string) => void;
  error?: string;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="text-body-sm mb-1 font-bold">{legend}</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {choices.map((c) => {
          const disabled = Boolean(c.disabledReason);
          const checked = value === c.value;
          return (
            <label
              key={c.value}
              className={cx(
                "relative flex min-h-16 cursor-pointer flex-col gap-0.5 rounded-xl border-2 p-3 transition-colors",
                checked
                  ? "border-primary bg-accent-soft"
                  : "border-border hover:border-border-strong",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="radio"
                name={`${id}-${name}`}
                className="sr-only"
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(c.value)}
                aria-describedby={disabled ? `${id}-${c.value}-why` : undefined}
              />
              <span className="flex items-center gap-2 font-semibold">
                {c.colours && c.colours.length > 0 && (
                  <span
                    aria-hidden="true"
                    className="border-border inline-flex size-5 shrink-0 overflow-hidden rounded-full border"
                  >
                    {c.colours.map((col, i) => (
                      <span
                        key={`${col}-${i}`}
                        className="h-full flex-1"
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </span>
                )}
                {c.label}
              </span>
              {disabled ? (
                <span id={`${id}-${c.value}-why`} className="text-caption text-muted-foreground">
                  {c.disabledReason}
                </span>
              ) : (
                c.note && <span className="text-caption text-muted-foreground">{c.note}</span>
              )}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="text-body-sm text-danger font-semibold">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** A step of the designer: a heading button that opens it, with the current choice beside it. */
function Step({
  number,
  title,
  summary,
  open,
  onToggle,
  hasError,
  children,
}: {
  number: number;
  title: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  hasError?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="border-border border-b last:border-b-0">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className="flex w-full items-center gap-3 py-4 text-left"
        >
          <span
            className={cx(
              "text-body-sm flex size-7 shrink-0 items-center justify-center rounded-full font-bold",
              open ? "bg-primary text-primary-foreground" : "bg-surface-muted",
            )}
          >
            {number}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="font-bold">{title}</span>
            <span
              className={cx(
                "text-body-sm truncate",
                hasError ? "text-danger" : "text-muted-foreground",
              )}
            >
              {summary}
            </span>
          </span>
          <span aria-hidden="true" className="text-muted-foreground">
            {open ? "−" : "+"}
          </span>
        </button>
      </h3>
      <div id={id} hidden={!open} className="flex flex-col gap-5 pb-6">
        {children}
      </div>
    </section>
  );
}

/**
 * The storefront's Cake Studio designer (BUN-181), on the ERP's Cake Studio
 * menu and pricing (BUN-179):
 *
 * - Steps: shape → size → decks → flavour and filling → icing → toppings and
 *   extras → message. Every choice shows its price impact.
 * - Choices the ERP wouldn't accept are disabled with the reason (a size not
 *   made in that shape, the drip only with a drip finish, the candle limit,
 *   the message length), and what depends on a change is tidied up.
 * - Every change redraws the 3D preview (BUN-182) and asks the ERP for the
 *   price (lines and total); the ERP's own messages show if it refuses something.
 *   Tapping a part of the cake opens its step.
 * - Undo (last 30 changes) and Start over; Save gives a design code
 *   with a picture of the 3D cake. **Add to cart** (BUN-184) saves it and
 *   adds it as a cart line; opened from the cart (`?line=`), it updates that line.
 * - On phones the steps stack and the price stays in a bar at the bottom.
 */
const noSubscribe = () => () => {};
/** The draft as it was when the page opened (read once, so saving it doesn't restart the designer). */
const openedDrafts = new Map<string, string>();

/**
 * The designer, starting from the customer's draft when there is one
 * (BUN-183): the design they were working on before a refresh, if today's
 * menu can still make it. The server renders the starting design; the
 * browser then switches to the draft.
 */
export function CakeDesigner({
  menu,
  initial,
  draftKey,
  productSlug,
  editLine,
}: {
  menu: Menu;
  initial: CakeDesign;
  draftKey: string;
  /** The Cake Studio product the designer was opened from, if any. */
  productSlug?: string;
  /** The cart line being edited ("Edit design" in the cart), if any. */
  editLine?: string;
}) {
  const text = useSyncExternalStore(
    noSubscribe,
    () => {
      if (!openedDrafts.has(draftKey)) openedDrafts.set(draftKey, readDraftText(draftKey));
      return openedDrafts.get(draftKey)!;
    },
    () => "",
  );
  // Read again next time the designer opens (another visit, not this one's saves).
  useEffect(() => () => void openedDrafts.delete(draftKey), [draftKey]);
  const draft = useMemo(() => parseDraft(text, menu), [text, menu]);
  const restored = draft !== null && JSON.stringify(draft) !== JSON.stringify(initial);
  return (
    <Designer
      key={restored ? "draft" : "start"}
      menu={menu}
      initial={initial}
      start={restored ? draft : initial}
      restored={restored}
      draftKey={draftKey}
      productSlug={productSlug}
      editLine={editLine}
    />
  );
}

function Designer({
  menu,
  initial,
  start,
  restored,
  draftKey,
  productSlug,
  editLine,
}: {
  menu: Menu;
  initial: CakeDesign;
  start: CakeDesign;
  restored: boolean;
  draftKey: string;
  productSlug?: string;
  editLine?: string;
}) {
  const router = useRouter();
  const { add: addToCart } = useAddToCart();
  const [design, setDesign] = useState(start);
  const [showRestored, setShowRestored] = useState(restored);
  const [round, setRound] = useState(0);
  const [history, setHistory] = useState<CakeDesign[]>([]);
  const [openStep, setOpenStep] = useState(1);
  const [quote, setQuote] = useState<QuoteState>({ status: "loading" });
  const [saving, setSaving] = useState<"save" | "cart" | null>(null);
  const [cartProblem, setCartProblem] = useState<string | null>(null);
  const [saved, setSaved] = useState<{
    id: string;
    total: number;
    previewUrl?: string;
    /** The price shown before saving, when the ERP's price at saving was different. */
    shownTotal?: number;
  } | null>(null);
  const grab = useRef<CakeGrab | null>(null);
  const onGrab = useCallback((g: CakeGrab | null) => {
    grab.current = g;
  }, []);

  const change = (patch: Partial<CakeDesign>) => {
    setHistory((h) => pushHistory(h, design));
    setDesign(applyChange(menu, design, patch));
    setSaved(null);
    setCartProblem(null);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory(history.slice(0, -1));
    setDesign(previous);
    setSaved(null);
  };
  const reset = () => {
    setHistory((h) => pushHistory(h, design));
    setDesign(initial);
    setSaved(null);
    setShowRestored(false);
  };

  const problems = designProblems(menu, design);
  const key = JSON.stringify(design);

  // Keep the design in this browser, so a refresh doesn't lose it (none kept for the untouched start).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (key === JSON.stringify(initial)) clearDraft(draftKey);
      else writeDraft(draftKey, JSON.parse(key));
    }, 400);
    return () => clearTimeout(timer);
  }, [key, initial, draftKey]);

  // Back on the tab after a while: ask for today's price again (the ERP's prices may have changed).
  const quotedAt = quote.status === "ready" ? quote.at : null;
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        quotedAt !== null &&
        Date.now() - quotedAt > QUOTE_FRESH_MS
      ) {
        setRound((r) => r + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [quotedAt]);

  // Ask the ERP for the price shortly after each change (it checks the design too).
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuote({ status: "loading" });
      try {
        const res = await fetch("/api/cake-studio/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: `{"design":${key}}`,
          signal: controller.signal,
        });
        const body = await res.json();
        if (res.ok) setQuote({ status: "ready", quote: body, at: Date.now() });
        else if (res.status === 422)
          setQuote({
            status: "invalid",
            message: body.message,
            fieldErrors: body.fieldErrors ?? {},
          });
        else setQuote({ status: "error", message: body.message ?? "We couldn't price this cake." });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setQuote({ status: "error", message: "We couldn't price this cake. Please try again." });
        }
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, round]);

  const erpErrors = quote.status === "invalid" ? quote.fieldErrors : {};
  const errorFor = (field: string) => problems[field] ?? erpErrors[field];

  /** A picture of the 3D cake for the saved design; none if it can't be taken. */
  async function previewPicture(): Promise<string | undefined> {
    try {
      const png = grab.current?.();
      if (!png) return undefined;
      const small = await shrinkPng(png);
      return small.length < 1_900_000 ? small : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Saves the design in the ERP (with a picture of the 3D cake). "cart" then
   * adds it to the cart (BUN-184): as a new line, or in place of the line
   * being edited, with that line's quantity.
   */
  async function save(target: "save" | "cart") {
    setSaving(target);
    setCartProblem(null);
    try {
      const preview = await previewPicture();
      const res = await fetch("/api/cake-studio/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ design, preview, productSlug }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 422) {
          setQuote({
            status: "invalid",
            message: body.message,
            fieldErrors: body.fieldErrors ?? {},
          });
        } else {
          setCartProblem(body.message ?? "We couldn't save your cake. Please try again.");
        }
        return;
      }
      const shown = quote.status === "ready" ? quote.quote.total : undefined;
      setSaved({
        id: body.id,
        total: body.total,
        previewUrl: body.previewUrl,
        shownTotal: shown !== undefined && shown !== body.total ? shown : undefined,
      });
      // The ERP priced it again when saving: show that price.
      setQuote({ status: "ready", quote: body, at: Date.now() });
      if (target === "save") return;

      if (!body.cartLine) {
        setCartProblem(
          "This cake size can't be ordered online yet. Your design is saved: call us with its code to order it.",
        );
        return;
      }
      const editing = editLine
        ? useCartStore.getState().items.find((i) => i.key === editLine)
        : undefined;
      const added = await addToCart({
        productSlug: body.cartLine.productSlug,
        skuId: body.cartLine.skuId,
        quantity: editing?.quantity ?? 1,
        // The server fills in the ERP's summary and picture when it checks the line.
        customization: { designId: body.id, summary: [], previewUrl: body.previewUrl },
        replaceKey: editing?.key,
      });
      if (added) {
        clearDraft(draftKey);
        if (editing) router.push("/cart");
      }
    } finally {
      setSaving(null);
    }
  }

  const option = (kind: keyof Menu["options"], id?: number | null) =>
    id == null ? undefined : menu.options[kind].find((o) => o.id === id);
  const size = menu.sizes.find((s) => s.id === design.size_id);
  const shape = menu.shapes.find((s) => s.id === design.shape_id);
  const finish = option("finish", design.finish_id);
  const candles = (design.topping_ids ?? [])
    .map((id) => option("topping", id))
    .find((t) => t?.maxCount);
  const optionChoices = (kind: keyof Menu["options"]): Choice[] =>
    menu.options[kind].map((o) => ({
      value: o.id,
      label: o.name,
      note: impact(o.price),
      colours: o.layerColours ?? (o.colour ? [o.colour] : undefined),
    }));
  const toggle = (list: number[] | null | undefined, id: number) =>
    (list ?? []).includes(id) ? (list ?? []).filter((x) => x !== id) : [...(list ?? []), id];

  const steps: { title: string; summary: string; fields: string[]; body: ReactNode }[] = [
    {
      title: "Shape",
      summary: shape?.name ?? "Choose a shape",
      fields: ["shape_id"],
      body: (
        <ChoiceCards
          name="shape"
          legend="Choose a shape"
          value={design.shape_id}
          onChange={(v) => change({ shape_id: Number(v) })}
          error={errorFor("shape_id")}
          choices={menu.shapes.map((s) => ({
            value: s.id,
            label: s.name,
            note: impact(shapeImpact(menu, design, s.id)),
            disabledReason: shapeProblem(menu, design, s.id),
          }))}
        />
      ),
    },
    {
      title: "Size",
      summary: size ? `${size.name}, serves ${size.servesMin}–${size.servesMax}` : "Choose a size",
      fields: ["size_id"],
      body: (
        <ChoiceCards
          name="size"
          legend="Choose a size"
          value={design.size_id}
          onChange={(v) => change({ size_id: Number(v) })}
          error={errorFor("size_id")}
          choices={menu.sizes.map((s) => {
            const price = sizePrice(menu, s.id, design.shape_id);
            return {
              value: s.id,
              label: s.name,
              note:
                price === undefined ? null : `${LKR(price)} · serves ${s.servesMin}–${s.servesMax}`,
              disabledReason: sizeProblem(menu, design, s.id),
            };
          })}
        />
      ),
    },
    {
      title: "Decks",
      summary: `${design.tier_count ?? 1} deck${(design.tier_count ?? 1) === 1 ? "" : "s"}`,
      fields: ["tier_count"],
      body: (
        <ChoiceCards
          name="decks"
          legend="How many decks (tiers)?"
          value={design.tier_count ?? 1}
          onChange={(v) => change({ tier_count: Number(v) })}
          error={errorFor("tier_count")}
          choices={deckChoices(menu, design.size_id).map((n) => ({
            value: n,
            label: `${n} deck${n === 1 ? "" : "s"}`,
            note: impact(
              deckImpact(menu, design.size_id, n) -
                deckImpact(menu, design.size_id, design.tier_count ?? 1),
            ),
          }))}
        />
      ),
    },
    {
      title: "Flavour and filling",
      summary: [
        option("sponge", design.sponge_id)?.name,
        option("filling", design.filling_id)?.name,
      ]
        .filter(Boolean)
        .join(", "),
      fields: ["sponge_id", "filling_id"],
      body: (
        <>
          <ChoiceCards
            name="sponge"
            legend="Sponge"
            value={design.sponge_id}
            onChange={(v) => change({ sponge_id: Number(v) })}
            error={errorFor("sponge_id")}
            choices={optionChoices("sponge")}
          />
          {menu.options.filling.length > 0 && (
            <ChoiceCards
              name="filling"
              legend="Filling"
              value={design.filling_id ?? 0}
              onChange={(v) => change({ filling_id: Number(v) || null })}
              error={errorFor("filling_id")}
              choices={[
                { value: 0, label: "No filling", note: "Included" },
                ...optionChoices("filling"),
              ]}
            />
          )}
        </>
      ),
    },
    {
      title: "Icing",
      summary: [
        option("frosting", design.frosting_id)?.name,
        finish?.name,
        option("drip", design.drip_id)?.name && `${option("drip", design.drip_id)?.name} drip`,
      ]
        .filter(Boolean)
        .join(", "),
      fields: ["frosting_id", "finish_id", "drip_id"],
      body: (
        <>
          <ChoiceCards
            name="frosting"
            legend="Icing colour"
            value={design.frosting_id}
            onChange={(v) => change({ frosting_id: Number(v) })}
            error={errorFor("frosting_id")}
            choices={optionChoices("frosting")}
          />
          <ChoiceCards
            name="finish"
            legend="Finish"
            value={design.finish_id}
            onChange={(v) => change({ finish_id: Number(v) })}
            error={errorFor("finish_id")}
            choices={optionChoices("finish")}
          />
          {menu.options.drip.length > 0 && (
            <ChoiceCards
              name="drip"
              legend="Drip flavour"
              value={design.drip_id}
              onChange={(v) => change({ drip_id: Number(v) })}
              error={errorFor("drip_id")}
              choices={optionChoices("drip").map((c) => ({
                ...c,
                disabledReason: finish?.needsDrip ? null : "Choose the drip finish first.",
              }))}
            />
          )}
        </>
      ),
    },
    {
      title: "Toppings and extras",
      summary:
        [
          ...(design.topping_ids ?? []).map((id) => option("topping", id)?.name),
          ...(design.extras ?? []).map((c) => menu.options.extra.find((e) => e.code === c)?.name),
        ]
          .filter(Boolean)
          .join(", ") || "None",
      fields: ["topping_ids", "candle_count", "extras", "topper_number"],
      body: (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-body-sm mb-1 font-bold">Toppings (choose any)</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {menu.options.topping.map((t) => {
                const checked = (design.topping_ids ?? []).includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={cx(
                      "flex cursor-pointer flex-col gap-0.5 rounded-xl border-2 p-3",
                      checked
                        ? "border-primary bg-accent-soft"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        className="accent-primary size-4"
                        checked={checked}
                        onChange={() => change({ topping_ids: toggle(design.topping_ids, t.id) })}
                      />
                      {t.name}
                    </span>
                    <span className="text-caption text-muted-foreground">
                      {impact(t.price)}
                      {t.maxCount ? ` · up to ${t.maxCount}` : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {candles && (
            <label className="flex items-center gap-3">
              <span className="text-body-sm font-bold">How many {candles.name.toLowerCase()}?</span>
              <input
                type="number"
                min={1}
                max={candles.maxCount}
                value={design.candle_count ?? 1}
                onChange={(e) => change({ candle_count: Number(e.target.value) })}
                className="border-border h-10 w-20 rounded-md border px-3"
              />
            </label>
          )}
          {menu.options.extra.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-body-sm mb-1 font-bold">Extras</legend>
              {menu.options.extra.map((x) => (
                <label key={x.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={(design.extras ?? []).includes(x.code ?? "")}
                    onChange={() => {
                      const code = x.code ?? "";
                      const list = design.extras ?? [];
                      change({
                        extras: list.includes(code)
                          ? list.filter((c) => c !== code)
                          : [...list, code],
                      });
                    }}
                  />
                  <span className="flex-1">{x.name}</span>
                  <span className="text-body-sm text-muted-foreground">{impact(x.price)}</span>
                </label>
              ))}
            </fieldset>
          )}
          {(design.extras ?? []).includes(NUMBER_TOPPER) && (
            <label className="flex flex-col gap-1">
              <span className="text-body-sm font-bold">Number for the topper</span>
              <input
                inputMode="numeric"
                maxLength={3}
                value={design.topper_number ?? ""}
                onChange={(e) => change({ topper_number: e.target.value.replace(/\D/g, "") })}
                aria-invalid={Boolean(errorFor("topper_number")) || undefined}
                className="border-border h-10 w-24 rounded-md border px-3"
              />
              {errorFor("topper_number") && (
                <span role="alert" className="text-body-sm text-danger font-semibold">
                  {errorFor("topper_number")}
                </span>
              )}
            </label>
          )}
          {errorFor("candle_count") && (
            <p role="alert" className="text-body-sm text-danger font-semibold">
              {errorFor("candle_count")}
            </p>
          )}
        </>
      ),
    },
    {
      title: "Message on the cake",
      summary: design.message ? `"${design.message}"` : "No message",
      fields: ["message", "lettering_id", "writing_colour_id", "occasion_id"],
      body: (
        <>
          {menu.occasions.length > 0 && (
            <ChoiceCards
              name="occasion"
              legend="Occasion (optional)"
              value={design.occasion_id ?? 0}
              onChange={(v) => change({ occasion_id: Number(v) || null })}
              choices={[
                { value: 0, label: "None" },
                ...menu.occasions.map((o) => ({ value: o.id, label: o.name })),
              ]}
            />
          )}
          {design.occasion_id && (
            <div className="flex flex-wrap gap-2">
              {menu.occasions
                .find((o) => o.id === design.occasion_id)
                ?.messages.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => change({ message: m })}
                    className="bg-surface-muted hover:bg-accent-soft text-body-sm rounded-full px-3 py-1"
                  >
                    {m}
                  </button>
                ))}
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-body-sm font-bold">
              Message (up to {menu.rules.messageMax} letters)
            </span>
            <input
              value={design.message ?? ""}
              maxLength={menu.rules.messageMax}
              onChange={(e) => change({ message: e.target.value })}
              placeholder="Happy Birthday"
              className="border-border h-11 rounded-md border px-3"
            />
            <span className="text-caption text-muted-foreground">
              {(design.message ?? "").length} / {menu.rules.messageMax}
            </span>
          </label>
          {design.message && (
            <>
              <ChoiceCards
                name="lettering"
                legend="Lettering"
                value={design.lettering_id}
                onChange={(v) => change({ lettering_id: Number(v) })}
                choices={optionChoices("lettering")}
              />
              <ChoiceCards
                name="writing"
                legend="Writing colour"
                value={design.writing_colour_id}
                onChange={(v) => change({ writing_colour_id: Number(v) })}
                choices={optionChoices("writing_colour")}
              />
            </>
          )}
        </>
      ),
    },
  ];

  // The 3D camera follows the open step: the slice for flavours, the top for the message.
  const autoView: CakeView = openStep === 4 ? "inside" : openStep === 7 ? "top" : "front";
  // A tapped part of the cake (PART_STEPS) opens its step: stand → size, slice → flavour, …
  const onPart = useCallback((part: number) => setOpenStep([2, 4, 5, 6, 7][part] ?? 1), []);

  const canSave = quote.status === "ready" && Object.keys(problems).length === 0 && !saving;
  const total = quote.status === "ready" ? quote.quote.total : null;
  // When it can be ready: the ERP's date for this design (else the size's), and the notice behind it.
  const readyOn =
    (quote.status === "ready" ? quote.quote.earliestDate : undefined) ?? size?.earliest;
  const sizeNotice = [menu.rules.noticeHours, size?.noticeHours].filter(
    (h): h is number => h !== undefined,
  );
  const noticeHours =
    (quote.status === "ready" ? quote.quote.noticeHours : undefined) ??
    (sizeNotice.length > 0 ? Math.max(...sizeNotice) : undefined);
  const priceText = quote.status === "loading" ? "Pricing…" : total !== null ? LKR(total) : "—";

  return (
    <div className="grid gap-8 pb-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:pb-0">
      <div className="flex flex-col gap-4 lg:sticky lg:top-(--sticky-offset) lg:self-start">
        {showRestored && (
          <div
            role="status"
            className="bg-accent-soft text-body-sm flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3"
          >
            <span className="font-semibold">We kept the cake you were designing.</span>
            <span className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={reset}>
                Start fresh
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowRestored(false)}>
                OK
              </Button>
            </span>
          </div>
        )}
        <Card className="bg-accent-soft border-0 p-4">
          <Cake3D menu={menu} design={design} autoView={autoView} onPart={onPart} onGrab={onGrab} />
        </Card>
        <Card
          className="flex flex-col gap-3"
          aria-live="polite"
          aria-busy={quote.status === "loading"}
        >
          <h2 className="text-h4">Your cake</h2>
          {quote.status === "ready" && (
            <>
              <ul className="flex flex-col gap-1">
                {quote.quote.lines.map((l) => (
                  <li key={l.label} className="text-body-sm flex justify-between gap-4">
                    <span>{l.label}</span>
                    <span>{LKR(l.price)}</span>
                  </li>
                ))}
              </ul>
              <p className="border-border text-body-lg flex justify-between gap-4 border-t pt-2 font-bold">
                <span>Total</span>
                <span>{LKR(quote.quote.total)}</span>
              </p>
              <p className="text-caption text-muted-foreground">
                Priced by our kitchen&apos;s system for this exact cake.
              </p>
            </>
          )}
          {readyOn && (
            <p className="bg-surface-muted text-body-sm rounded-md px-3 py-2">
              <span className="font-semibold">Ready from {readyDateText(readyOn)}.</span>
              {noticeHours !== undefined && noticeHours > 0 && (
                <> We need {noticeText(noticeHours)} notice to bake it.</>
              )}
            </p>
          )}
          {quote.status === "loading" && (
            <p className="text-body-sm text-muted-foreground flex items-center gap-2">
              <Spinner size="sm" label={null} /> Pricing your cake…
            </p>
          )}
          {(quote.status === "invalid" || quote.status === "error") && (
            <p role="alert" className="text-body-sm text-danger font-semibold">
              {quote.message}
            </p>
          )}
          {quote.status === "error" && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setRound(round + 1)}
            >
              Try again
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={undo} disabled={history.length === 0}>
              Undo
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              Start over
            </Button>
          </div>
          {/* On phones, Add to cart is in the bottom bar instead. */}
          <div className="hidden lg:block">
            <Button
              fullWidth
              onClick={() => save("cart")}
              loading={saving === "cart"}
              disabled={!canSave}
            >
              {editLine ? "Update cart" : "Add to cart"}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => save("save")}
            loading={saving === "save"}
            disabled={!canSave}
          >
            Save design for later
          </Button>
          {cartProblem && (
            <p role="alert" className="text-body-sm text-danger font-semibold">
              {cartProblem}
            </p>
          )}
          {saved && (
            <p
              role="status"
              className="bg-success-soft text-success text-body-sm flex items-center gap-3 rounded-md px-3 py-2 font-semibold"
            >
              {saved.previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- the ERP's picture of this design
                <img
                  src={saved.previewUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="bg-surface size-14 shrink-0 rounded-md object-contain"
                />
              )}
              <span>
                Saved ({LKR(saved.total)}).{" "}
                <Link
                  href={`/cake-studio?design=${encodeURIComponent(saved.id)}`}
                  className="underline"
                >
                  Your design code is {saved.id}
                </Link>
                .
                {saved.shownTotal !== undefined && (
                  <>
                    {" "}
                    The price changed from {LKR(saved.shownTotal)} while you were designing; this is
                    today&apos;s price.
                  </>
                )}
              </span>
            </p>
          )}
        </Card>
      </div>

      <Card padding="none" className="px-4 sm:px-6">
        {steps.map((step, i) => (
          <Step
            key={step.title}
            number={i + 1}
            title={step.title}
            summary={step.summary || "—"}
            open={openStep === i + 1}
            onToggle={() => setOpenStep(openStep === i + 1 ? 0 : i + 1)}
            hasError={step.fields.some((f) => errorFor(f))}
          >
            {step.body}
            {i < steps.length - 1 && (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setOpenStep(i + 2)}
              >
                Next: {steps[i + 1].title}
              </Button>
            )}
          </Step>
        ))}
      </Card>

      {/* Phones: the price and Add to cart stay in reach at the bottom. */}
      <div className="border-border bg-surface fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t px-4 py-3 shadow-lg lg:hidden">
        <span className="flex flex-col">
          <span className="text-caption text-muted-foreground">Your cake</span>
          <span className="font-bold">{priceText}</span>
        </span>
        <Button
          size="sm"
          onClick={() => save("cart")}
          loading={saving === "cart"}
          disabled={!canSave}
        >
          {editLine ? "Update cart" : "Add to cart"}
        </Button>
      </div>
    </div>
  );
}
