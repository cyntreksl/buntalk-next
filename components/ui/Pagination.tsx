import Link from "next/link";
import { cx } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

type PaginationProps = {
  page: number;
  totalPages: number;
  /** Base path; the page number is added as ?page=N (page 1 has no parameter). */
  basePath: string;
  /** Other query parameters to keep, e.g. { q: "buns" }. */
  query?: Record<string, string>;
  className?: string;
};

/** Page numbers to show, with "…" gaps: 1 … 4 5 6 … 20 */
export function pageRange(page: number, total: number): Array<number | "gap"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ["gap" as const, p] : [p]));
}

function hrefFor(basePath: string, page: number, query?: Record<string, string>) {
  const params = new URLSearchParams(query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

const itemClasses =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-md px-3 text-body-sm font-bold";

/** Page links for long lists. Uses real links, so it works without JavaScript and for search engines. */
export function Pagination({ page, totalPages, basePath, query, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const linkClasses = cx(itemClasses, "text-foreground hover:bg-surface-muted");
  const disabledClasses = cx(itemClasses, "text-muted-foreground opacity-50");

  return (
    <nav aria-label="Pagination" className={className}>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          {page > 1 ? (
            <Link href={hrefFor(basePath, page - 1, query)} className={linkClasses} rel="prev">
              <ChevronLeftIcon size={18} />
              <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
            </Link>
          ) : (
            <span className={disabledClasses} aria-disabled="true">
              <ChevronLeftIcon size={18} />
              <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
            </span>
          )}
        </li>
        {pageRange(page, totalPages).map((p, i) =>
          p === "gap" ? (
            <li
              key={`gap-${i}`}
              aria-hidden="true"
              className={cx(itemClasses, "text-muted-foreground")}
            >
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(basePath, p, query)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={cx(
                  itemClasses,
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-surface-muted",
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link href={hrefFor(basePath, page + 1, query)} className={linkClasses} rel="next">
              <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
              <ChevronRightIcon size={18} />
            </Link>
          ) : (
            <span className={disabledClasses} aria-disabled="true">
              <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
              <ChevronRightIcon size={18} />
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
