"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { SearchIcon } from "@/components/ui";
import { useDismiss } from "@/components/ui/useDismiss";
import type { SearchSuggestions } from "@/lib/search";
import { cx, formatPrice } from "@/lib/utils";

/** Wait this long after the last key before asking (keeps suggestions well under ~300 ms). */
const DEBOUNCE_MS = 120;

type Option = { id: string; href: string; label: string };

// Answers already fetched in this tab, so going back over a word is instant.
const answers = new Map<string, SearchSuggestions>();

/**
 * Search box with type-ahead suggestions (BUN-172).
 *
 * - A plain GET form to /search, so Enter and the button work before (or
 *   without) JavaScript.
 * - After two letters it suggests matching categories and products from
 *   /api/search/suggest (typo-tolerant, visible products only).
 * - Keyboard: ↓ ↑ move through suggestions, Enter opens the highlighted one
 *   (or searches), Escape closes. WAI-ARIA combobox with a listbox popup.
 */
export function HeaderSearch({ id, className }: { id: string; className?: string }) {
  const router = useRouter();
  const listId = useId();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<SearchSuggestions | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const containerRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setActive(-1);
  }, []);
  useDismiss(containerRef, open, close, inputRef);

  const query = value.trim();

  // Fetch suggestions shortly after typing stops; drop answers for older text.
  useEffect(() => {
    if (query.length < 2 || answers.has(query.toLowerCase())) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const body: SearchSuggestions = await res.json();
        answers.set(query.toLowerCase(), body);
        setResult(body);
      } catch {
        // Aborted (newer text) or offline: keep the last suggestions.
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // This text's answer if we have it, else the last one while the new one loads.
  const fresh = query.length >= 2 ? (answers.get(query.toLowerCase()) ?? result) : null;
  const options: Option[] = fresh
    ? [
        ...fresh.categories.map((c) => ({
          id: `${listId}-c-${c.slug}`,
          href: `/category/${c.slug}`,
          label: c.name,
        })),
        ...fresh.products.map((p) => ({
          id: `${listId}-p-${p.slug}`,
          href: `/product/${p.slug}`,
          label: p.name,
        })),
        {
          id: `${listId}-all`,
          href: `/search?q=${encodeURIComponent(query)}`,
          label: `See all results for “${query}”`,
        },
      ]
    : [];
  const showList = open && options.length > 0;
  const nothing = fresh && fresh.categories.length === 0 && fresh.products.length === 0;

  const go = (href: string) => {
    close();
    inputRef.current?.blur();
    router.push(href);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showList) {
      if (event.key === "ArrowDown" && options.length > 0) {
        event.preventDefault();
        setOpen(true);
        setActive(0);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((a) => (a + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((a) => (a <= 0 ? options.length - 1 : a - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      go(options[active].href);
    }
  };

  const optionClasses = (i: number) =>
    cx(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-body-sm",
      i === active ? "bg-surface-muted" : "hover:bg-surface-muted",
    );
  // Option positions: categories first, then products, then "See all results".
  const categoryCount = fresh?.categories.length ?? 0;
  const allIndex = options.length - 1;

  return (
    <form
      ref={containerRef}
      action="/search"
      role="search"
      className={cx("relative flex w-full", className)}
      onSubmit={() => close()}
    >
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <SearchIcon
        size={18}
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
      />
      <input
        ref={inputRef}
        id={id}
        name="q"
        type="search"
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? options[active]?.id : undefined}
        placeholder="Search for buns, cakes, short eats…"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="bg-surface-muted text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:bg-surface focus-visible:border-ring h-11 w-full rounded-full border border-transparent pr-14 pl-11 transition-colors"
      />
      <button
        type="submit"
        aria-label="Search"
        className="bg-primary text-primary-foreground hover:bg-primary-hover absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
      >
        <SearchIcon size={16} />
      </button>

      <div
        hidden={!showList}
        className="border-border bg-surface absolute top-full right-0 left-0 z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border p-2 shadow-lg"
      >
        <ul id={listId} role="listbox" aria-label="Search suggestions" className="flex flex-col">
          {fresh && fresh.categories.length > 0 && (
            <li
              role="presentation"
              className="text-caption text-muted-foreground px-3 pt-1 pb-1 font-bold tracking-wider uppercase"
            >
              Categories
            </li>
          )}
          {fresh?.categories.map((c, n) => {
            return (
              <li key={c.slug} id={options[n].id} role="option" aria-selected={n === active}>
                <Link
                  href={options[n].href}
                  tabIndex={-1}
                  onClick={close}
                  onPointerMove={() => setActive(n)}
                  className={optionClasses(n)}
                >
                  <SearchIcon size={16} className="text-muted-foreground shrink-0" />
                  <span>
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-muted-foreground"> · category</span>
                  </span>
                </Link>
              </li>
            );
          })}
          {fresh && fresh.products.length > 0 && (
            <li
              role="presentation"
              className="text-caption text-muted-foreground px-3 pt-2 pb-1 font-bold tracking-wider uppercase"
            >
              Products
            </li>
          )}
          {fresh?.products.map((p, k) => {
            const n = categoryCount + k;
            return (
              <li key={p.slug} id={options[n].id} role="option" aria-selected={n === active}>
                <Link
                  href={options[n].href}
                  tabIndex={-1}
                  onClick={close}
                  onPointerMove={() => setActive(n)}
                  className={optionClasses(n)}
                >
                  <Thumb src={p.imageUrl} name={p.name} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
                  <span className="text-muted-foreground shrink-0">
                    {p.from && "From "}
                    {formatPrice(p.price, p.currency)}
                  </span>
                </Link>
              </li>
            );
          })}
          {nothing && (
            <li role="presentation" className="text-body-sm text-muted-foreground px-3 py-2">
              No suggestions. Press Enter to search anyway.
            </li>
          )}
          {fresh && (
            <li id={options[allIndex].id} role="option" aria-selected={allIndex === active}>
              <Link
                href={options[allIndex].href}
                tabIndex={-1}
                onClick={close}
                onPointerMove={() => setActive(allIndex)}
                className={cx(optionClasses(allIndex), "text-primary mt-1 font-bold")}
              >
                {options[allIndex].label}
              </Link>
            </li>
          )}
        </ul>
      </div>
      <p className="sr-only" aria-live="polite">
        {showList && fresh
          ? `${fresh.products.length} products and ${fresh.categories.length} categories suggested`
          : ""}
      </p>
    </form>
  );
}

/** Small product photo, or its first letter when there's none or it fails to load. */
function Thumb({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="bg-accent-soft text-accent-soft-foreground relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md font-bold">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny thumbnail from the ERP host (not optimised yet)
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        name.charAt(0)
      )}
    </span>
  );
}
