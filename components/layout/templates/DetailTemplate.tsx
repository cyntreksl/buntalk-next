import type { ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui";
import { Container } from "../Container";

type DetailTemplateProps = {
  breadcrumb?: BreadcrumbItem[];
  /** Images / gallery. */
  media: ReactNode;
  /** Title, price, options and the buy button. Should contain the page <h1>. */
  summary: ReactNode;
  /** Full-width content below: description tabs, reviews, related products. */
  children?: ReactNode;
};

/**
 * Detail template (product page).
 *
 * - Phone: breadcrumb, media, summary, details — stacked.
 * - Tablet (md+): media and summary side by side (equal columns).
 * - Desktop (lg+): media gets a bit more room; the summary sticks while the
 *   media scrolls.
 */
export function DetailTemplate({ breadcrumb, media, summary, children }: DetailTemplateProps) {
  return (
    <Container className="flex flex-col gap-6 py-8 md:gap-10 md:py-12">
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="grid gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        <div className="min-w-0">{media}</div>
        <div className="min-w-0">
          <div className="flex flex-col gap-5 md:sticky md:top-6">{summary}</div>
        </div>
      </div>
      {children && <div className="min-w-0">{children}</div>}
    </Container>
  );
}
