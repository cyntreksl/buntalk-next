"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Select } from "@/components/ui";
import { DEFAULT_SORT, SORTS, type SortKey } from "@/lib/listing";
import { cx } from "@/lib/utils";

/**
 * "Sort by" control for product listings (BUN-169), using the branded
 * dropdown. Picking an option goes to the same page with ?sort= set (and
 * back to page 1), keeping other query parameters such as the search text.
 *
 * Without JavaScript, a plain GET form with a native select and an "Apply"
 * button does the same (inside <noscript>).
 */
export function SortSelect({
  action,
  value,
  options,
  keep = [],
}: {
  action: string;
  value: SortKey;
  options: SortKey[];
  /** Other query parameters to keep (search text, filters); keys may repeat. */
  keep?: [string, string][];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // While the new page loads, show the option just picked; otherwise the URL's sort.
  // Controlled (never remounted), so keyboard focus stays on the control after a pick,
  // and Back/Forward update it because `value` comes from the URL.
  const [picked, setPicked] = useState(value);
  const shown = pending ? picked : value;

  const go = (sort: string) => {
    setPicked(sort as SortKey);
    const params = new URLSearchParams(keep);
    if (sort !== DEFAULT_SORT) params.set("sort", sort);
    const search = params.toString();
    startTransition(() => router.push(search ? `${action}?${search}` : action, { scroll: false }));
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-body-sm text-muted-foreground whitespace-nowrap" aria-hidden="true">
        Sort by
      </span>
      <div className={cx("w-52 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        <Select
          size="sm"
          aria-label="Sort by"
          value={shown}
          onValueChange={go}
          options={options.map((key) => ({ value: key, label: SORTS[key] }))}
        />
      </div>
      <noscript>
        <form action={action} method="get" className="flex items-center gap-2">
          {keep.map(([name, v]) => (
            <input key={`${name}=${v}`} type="hidden" name={name} value={v} />
          ))}
          <select name="sort" defaultValue={value} aria-label="Sort by">
            {options.map((key) => (
              <option key={key} value={key}>
                {SORTS[key]}
              </option>
            ))}
          </select>
          <button type="submit">Apply</button>
        </form>
      </noscript>
    </div>
  );
}
