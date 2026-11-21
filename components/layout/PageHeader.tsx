import type { ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui";
import { cx } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  /** Buttons or controls shown next to the title on wide screens, below it on phones. */
  actions?: ReactNode;
  className?: string;
};

/** Page title block shared by the templates: breadcrumb, h1, description and actions. */
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cx("flex flex-col gap-3", className)}>
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="text-h1 break-words">{title}</h1>
          {description && <p className="text-muted-foreground max-w-prose">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
