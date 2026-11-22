import { SearchIcon } from "@/components/ui";
import { cx } from "@/lib/utils";

/**
 * Search box entry point: a wide pill with the search button inside it.
 * A plain GET form to /search, so it works before JavaScript loads. The
 * /search page shows the results.
 */
export function HeaderSearch({ id, className }: { id: string; className?: string }) {
  return (
    <form action="/search" role="search" className={cx("relative flex w-full", className)}>
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <SearchIcon
        size={18}
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
      />
      <input
        id={id}
        name="q"
        type="search"
        placeholder="Search for buns, cakes, short eats…"
        className="bg-surface-muted text-body-sm text-foreground placeholder:text-muted-foreground focus-visible:bg-surface focus-visible:border-ring h-11 w-full rounded-full border border-transparent pr-14 pl-11 transition-colors"
      />
      <button
        type="submit"
        aria-label="Search"
        className="bg-primary text-primary-foreground hover:bg-primary-hover absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
      >
        <SearchIcon size={16} />
      </button>
    </form>
  );
}
