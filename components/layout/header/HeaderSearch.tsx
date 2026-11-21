import { Button, Input, SearchIcon } from "@/components/ui";
import { cx } from "@/lib/utils";

/**
 * Search box entry point. A plain GET form to /search, so it works before
 * JavaScript loads. The /search page shows the results.
 */
export function HeaderSearch({ id, className }: { id: string; className?: string }) {
  return (
    <form action="/search" role="search" className={cx("flex w-full gap-2", className)}>
      <label htmlFor={id} className="sr-only">
        Search products
      </label>
      <Input id={id} name="q" type="search" placeholder="Search products" className="h-10" />
      <Button type="submit" variant="secondary" size="sm" className="h-10 px-3" aria-label="Search">
        <SearchIcon size={18} />
      </Button>
    </form>
  );
}
