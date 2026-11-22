"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { cx } from "@/lib/utils";
import { useFieldControlProps } from "./FormField";
import { CheckIcon, ChevronDownIcon } from "./icons";
import { controlClasses } from "./Input";
import { useDismiss } from "./useDismiss";

export type SelectOption = { value: string; label: ReactNode; disabled?: boolean };

type SelectProps = {
  options: SelectOption[];
  /** Form field name: the chosen value is submitted with the form (hidden input). */
  name?: string;
  /** Controlled value. */
  value?: string;
  /** Uncontrolled starting value ("" = nothing chosen). */
  defaultValue?: string;
  /** Called with the new value when the customer picks an option. */
  onValueChange?: (value: string) => void;
  /** Shown when nothing is selected. */
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** "md" (forms, 44px) or "sm" (toolbars, 40px, pill). */
  size?: "md" | "sm";
  className?: string;
};

/**
 * Branded dropdown (replaces the browser's own <select> list).
 *
 * Follows the WAI-ARIA "select-only combobox" pattern, so it works like a
 * native select for keyboard and screen-reader users:
 * - Enter, Space, Alt+↓ or a click opens it; ↑ ↓ Home End move; Enter/Space
 *   or a click picks; Escape closes without picking; Tab picks the
 *   highlighted option and moves on.
 * - Typing letters jumps to the matching option, open or closed.
 * - Focus stays on the button; the highlighted option is announced through
 *   aria-activedescendant. The list opens upwards when there's no room below.
 *
 * Put it inside <FormField> for a label, hint and error. With `name`, the
 * value is sent with the form through a hidden input.
 */
export function Select({
  options,
  name,
  value: controlled,
  defaultValue = "",
  onValueChange,
  placeholder = "Select…",
  disabled,
  size = "md",
  className,
  ...props
}: SelectProps) {
  const field = useFieldControlProps(props);
  const autoId = useId();
  const id = field.id ?? autoId;
  const listId = `${id}-listbox`;
  const optionId = (i: number) => `${id}-option-${i}`;

  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;
  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = options[selectedIndex];

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const close = useCallback(() => setOpen(false), []);
  useDismiss(containerRef, open, close, buttonRef);

  const enabled = (i: number) => i >= 0 && i < options.length && !options[i].disabled;
  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) if (enabled(i)) return i;
    return from;
  };
  const firstEnabled = () => step(-1, 1);
  const lastEnabled = () => step(options.length, -1);

  const choose = (i: number) => {
    if (!enabled(i)) return;
    const next = options[i].value;
    if (controlled === undefined) setUncontrolled(next);
    setOpen(false);
    if (next !== value) onValueChange?.(next);
  };

  const openList = (highlight = selectedIndex >= 0 ? selectedIndex : firstEnabled()) => {
    if (disabled) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    setOpenUp(!!rect && window.innerHeight - rect.bottom < 280 && rect.top > 280);
    setActive(highlight);
    setOpen(true);
  };

  // Keep the highlighted option in view while moving through a long list.
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
    // optionId is derived from a stable id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);

  /** Type-to-select: "w" → "Wedding cakes"; typing quickly matches more letters. */
  const typeahead = (char: string) => {
    const now = Date.now();
    typed.current = {
      text: now - typed.current.at > 600 ? char : typed.current.text + char,
      at: now,
    };
    const query = typed.current.text.toLowerCase();
    const start = open ? active : selectedIndex;
    const order = [...options.keys()].map((k) => (k + start + 1) % options.length);
    const hit = order.find(
      (i) =>
        enabled(i) &&
        String(typeof options[i].label === "string" ? options[i].label : options[i].value)
          .toLowerCase()
          .startsWith(query),
    );
    if (hit === undefined) return;
    if (open) setActive(hit);
    else choose(hit);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const { key } = event;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) {
        event.preventDefault();
        openList(key === "ArrowUp" && selectedIndex < 0 ? lastEnabled() : undefined);
      } else if (key === "Home" || key === "End") {
        event.preventDefault();
        openList(key === "Home" ? firstEnabled() : lastEnabled());
      } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        typeahead(key);
      }
      return;
    }
    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((a) => step(a, 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        if (event.altKey) choose(active);
        else setActive((a) => step(a, -1));
        break;
      case "Home":
        event.preventDefault();
        setActive(firstEnabled());
        break;
      case "End":
        event.preventDefault();
        setActive(lastEnabled());
        break;
      case "PageDown":
      case "PageUp": {
        event.preventDefault();
        const dir = key === "PageDown" ? 1 : -1;
        setActive((a) => {
          let next = a;
          for (let n = 0; n < 10; n++) next = step(next, dir);
          return next;
        });
        break;
      }
      case "Enter":
      case " ":
        event.preventDefault();
        choose(active);
        break;
      case "Tab":
        choose(active);
        break;
      case "Escape":
        // useDismiss closes it and keeps focus on the button.
        break;
      default:
        if (key.length === 1 && !event.ctrlKey && !event.metaKey) typeahead(key);
    }
  };

  return (
    <div ref={containerRef} className={cx("relative", className)}>
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      <button
        ref={buttonRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-label={props["aria-label"]}
        aria-describedby={field["aria-describedby"]}
        aria-invalid={field["aria-invalid"]}
        aria-required={field.required || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cx(
          controlClasses,
          "flex items-center justify-between gap-2 text-left",
          size === "md" ? "h-11 pr-3" : "text-body-sm h-10 rounded-full pr-3 pl-4 font-semibold",
          open && "border-ring",
        )}
      >
        <span className={cx("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDownIcon
          size={18}
          className={cx(
            "text-muted-foreground shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-labelledby={id}
        tabIndex={-1}
        hidden={!open}
        className={cx(
          "border-border bg-surface absolute z-50 max-h-64 min-w-full overflow-auto rounded-xl border p-1.5 shadow-lg",
          openUp ? "bottom-full mb-1.5" : "top-full mt-1.5",
          size === "sm" ? "right-0 w-max" : "left-0 w-full",
        )}
      >
        {options.map((option, i) => {
          const isSelected = i === selectedIndex;
          return (
            <li
              key={option.value}
              id={optionId(i)}
              role="option"
              aria-selected={isSelected}
              aria-disabled={option.disabled || undefined}
              // Keep focus on the button (a pointerdown would move it to the list).
              onPointerDown={(e) => e.preventDefault()}
              onPointerMove={() => enabled(i) && setActive(i)}
              onClick={() => choose(i)}
              className={cx(
                "text-body-sm flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5",
                i === active && "bg-surface-muted",
                isSelected ? "text-primary font-bold" : "text-foreground",
                option.disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span>{option.label}</span>
              {isSelected && <CheckIcon size={16} className="shrink-0" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
