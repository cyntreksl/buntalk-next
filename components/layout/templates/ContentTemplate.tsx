import type { ReactNode } from "react";
import type { BreadcrumbItem } from "@/components/ui";
import { Container } from "../Container";
import { PageHeader } from "../PageHeader";

type ContentTemplateProps = {
  title: ReactNode;
  description?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  /** e.g. "Last updated 22 November 2026" for policy pages. */
  meta?: ReactNode;
  children: ReactNode;
};

/**
 * Content template: text pages such as policies, help and about. One readable
 * column (max 640px wide) so long text is comfortable to read.
 */
export function ContentTemplate({
  title,
  description,
  breadcrumb,
  meta,
  children,
}: ContentTemplateProps) {
  return (
    <Container width="content" className="flex flex-col gap-6 py-8 md:py-12">
      <PageHeader title={title} description={description} breadcrumb={breadcrumb} />
      {meta && <p className="text-body-sm text-muted-foreground -mt-2">{meta}</p>}
      <div className="flex max-w-prose flex-col gap-4">{children}</div>
    </Container>
  );
}
