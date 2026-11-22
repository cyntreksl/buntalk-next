"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent } from "react";
import { Button, Checkbox } from "@/components/ui";
import type { Facets, FilterState } from "@/lib/filters";
import { cx, formatPrice } from "@/lib/utils";

type FilterPanelProps = {
  facets: Facets;
  state: FilterState;
  /** The listing's path, e.g. /category/cakes or /search. */
  basePath: string;
  /** Other parameters to keep: the search text and the sort order. */
  keep: [string, string][];
  currency: string;
};

const stateKey = (s: FilterState) => JSON.stringify(s);

/**
 * Filter sidebar / drawer content (BUN-173): category, price range, on offer
 * and the product options and tags that exist in the current results.
 *
 * Ticking a box goes straight to the filtered URL (back to page 1, keeping the
 * search text and sort), and the server sends the new results and counts. The
 * boxes update at once and keep focus. Without JavaScript it is a plain GET
 * form with an "Apply" button.
 */
export function FilterPanel({ facets, state, basePath, keep, currency }: FilterPanelProps) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  // What's ticked right now. Follows the URL (Back/Forward, chips) without remounting,
  // so keyboard focus stays on the box just ticked.
  const [draft, setDraft] = useState(state);
  const [seen, setSeen] = useState(stateKey(state));
  const [min, setMin] = useState(state.min?.toString() ?? "");
  const [max, setMax] = useState(state.max?.toString() ?? "");
  if (seen !== stateKey(state)) {
    setSeen(stateKey(state));
    setDraft(state);
    setMin(state.min?.toString() ?? "");
    setMax(state.max?.toString() ?? "");
  }

  const go = (next: FilterState) => {
    setDraft(next);
    const params = new URLSearchParams(keep);
    for (const c of next.categories) params.append("cat", c);
    if (next.min !== undefined) params.set("min", String(next.min));
    if (next.max !== undefined) params.set("max", String(next.max));
    if (next.offer) params.set("offer", "1");
    for (const [k, vs] of Object.entries(next.groups)) for (const v of vs) params.append(k, v);
    const search = params.toString();
    startTransition(() =>
      router.push(search ? `${basePath}?${search}` : basePath, { scroll: false }),
    );
  };

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const toNumber = (s: string) => {
    const n = Number(s);
    return s.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const applyPrice = (event: FormEvent) => {
    event.preventDefault();
    let lo = toNumber(min);
    let hi = toNumber(max);
    if (lo !== undefined && hi !== undefined && lo > hi) [lo, hi] = [hi, lo];
    go({ ...draft, min: lo, max: hi });
  };

  const clearHref = (() => {
    const search = new URLSearchParams(keep).toString();
    return search ? `${basePath}?${search}` : basePath;
  })();
  const anyActive =
    draft.categories.length > 0 ||
    draft.min !== undefined ||
    draft.max !== undefined ||
    draft.offer ||
    Object.values(draft.groups).some((v) => v.length > 0);

  const count = (n: number) => <span className="text-muted-foreground"> ({n})</span>;

  return (
    <form
      action={basePath}
      method="get"
      onSubmit={applyPrice}
      aria-busy={pending}
      className={cx("flex flex-col gap-6 transition-opacity", pending && "opacity-70")}
    >
      {keep.map(([k, v]) => (
        <input key={`${k}=${v}`} type="hidden" name={k} value={v} />
      ))}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h4">Filter by</h2>
        {anyActive && (
          <Link
            href={clearHref}
            scroll={false}
            className="text-body-sm text-primary font-bold underline-offset-4 hover:underline"
          >
            Clear all
          </Link>
        )}
      </div>

      {facets.categories.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-sm mb-2 font-bold">Category</legend>
          {facets.categories.map((o) => (
            <Checkbox
              key={o.value}
              name="cat"
              value={o.value}
              checked={draft.categories.includes(o.value)}
              onChange={() => go({ ...draft, categories: toggle(draft.categories, o.value) })}
              label={
                <>
                  {o.label}
                  {count(o.count)}
                </>
              }
            />
          ))}
        </fieldset>
      )}

      {facets.price && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-sm mb-2 font-bold">Price ({currency})</legend>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`${id}-min`}>
              Minimum price
            </label>
            <input
              id={`${id}-min`}
              name="min"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={String(Math.floor(facets.price.min))}
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="border-border bg-surface text-body-sm focus-visible:border-ring h-10 w-full min-w-0 rounded-md border px-3"
            />
            <span aria-hidden="true" className="text-muted-foreground">
              –
            </span>
            <label className="sr-only" htmlFor={`${id}-max`}>
              Maximum price
            </label>
            <input
              id={`${id}-max`}
              name="max"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder={String(Math.ceil(facets.price.max))}
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="border-border bg-surface text-body-sm focus-visible:border-ring h-10 w-full min-w-0 rounded-md border px-3"
            />
            <Button type="submit" size="sm" variant="outline">
              Go
            </Button>
          </div>
          <p className="text-caption text-muted-foreground">
            {formatPrice(facets.price.min, currency)} – {formatPrice(facets.price.max, currency)} in
            these results
          </p>
        </fieldset>
      )}

      {(facets.offer.count > 0 || facets.offer.selected) && (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-body-sm mb-2 font-bold">Offers</legend>
          <Checkbox
            name="offer"
            value="1"
            checked={draft.offer}
            onChange={() => go({ ...draft, offer: !draft.offer })}
            label={
              <>
                On offer
                {count(facets.offer.count)}
              </>
            }
          />
        </fieldset>
      )}

      {facets.groups.map((group) => (
        <fieldset key={group.key} className="flex flex-col gap-2">
          <legend className="text-body-sm mb-2 font-bold">{group.label}</legend>
          {group.options.map((o) => (
            <Checkbox
              key={o.value}
              name={group.key}
              value={o.value}
              checked={(draft.groups[group.key] ?? []).includes(o.value)}
              onChange={() =>
                go({
                  ...draft,
                  groups: {
                    ...draft.groups,
                    [group.key]: toggle(draft.groups[group.key] ?? [], o.value),
                  },
                })
              }
              label={
                <>
                  {o.label}
                  {count(o.count)}
                </>
              }
            />
          ))}
        </fieldset>
      ))}

      <noscript>
        <Button type="submit" fullWidth>
          Apply filters
        </Button>
      </noscript>
    </form>
  );
}
