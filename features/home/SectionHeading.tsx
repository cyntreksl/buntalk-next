import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/ui";

/** Home page section title with an optional "View all" link on the right. */
export function SectionHeading({
  id,
  title,
  description,
  viewAll,
}: {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  viewAll?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 md:mb-6">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-h2">
          {title}
        </h2>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {viewAll && (
        <Link
          href={viewAll.href}
          className="text-body-sm text-primary inline-flex shrink-0 items-center gap-0.5 font-bold hover:underline"
        >
          {viewAll.label}
          <ChevronRightIcon size={16} />
        </Link>
      )}
    </div>
  );
}
