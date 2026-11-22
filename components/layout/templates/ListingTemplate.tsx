import type { ReactNode } from "react";
import type { BreadcrumbItem } from "@/components/ui";
import { Container } from "../Container";
import { PageHeader } from "../PageHeader";
import { ListingSidebar } from "./ListingSidebar";

type ListingTemplateProps = {
  title: ReactNode;
  /**
   * Replaces the standard page header (breadcrumb, h1, description), e.g. the
   * category banner. It must render the page's <h1>.
   */
  header?: ReactNode;
  description?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  /** Filters / category navigation. Omit for a listing without a sidebar (e.g. search). */
  sidebar?: ReactNode;
  /** Label for the sidebar and its button on small screens. */
  sidebarTitle?: string;
  /** Above the grid: result count, sort control… */
  toolbar?: ReactNode;
  /** The grid of items. */
  children: ReactNode;
  /** Below the grid, usually <Pagination>. */
  pagination?: ReactNode;
};

/**
 * Listing template (category, search, collections).
 *
 * - Phone/tablet: header, then a "Filters" button (opens the sidebar in a
 *   drawer), toolbar, grid, pagination — all full width.
 * - Desktop (lg+): sidebar column (16rem) on the left, grid on the right.
 */
export function ListingTemplate({
  title,
  header,
  description,
  breadcrumb,
  sidebar,
  sidebarTitle = "Filters",
  toolbar,
  children,
  pagination,
}: ListingTemplateProps) {
  return (
    <Container className="flex flex-col gap-6 py-8 md:gap-8 md:py-12">
      {header ?? <PageHeader title={title} description={description} breadcrumb={breadcrumb} />}
      <div className={sidebar ? "grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10" : ""}>
        {sidebar && <ListingSidebar title={sidebarTitle}>{sidebar}</ListingSidebar>}
        <div className="flex min-w-0 flex-col gap-6">
          {toolbar && (
            <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              {toolbar}
            </div>
          )}
          {children}
          {pagination && <div className="flex justify-center pt-2">{pagination}</div>}
        </div>
      </div>
    </Container>
  );
}
