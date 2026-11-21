import type { ComponentProps, ElementType } from "react";
import { cx } from "@/lib/utils";

const widths = {
  page: "max-w-page", // 1152px: most pages
  content: "max-w-content", // 768px: cart, forms, text pages
  prose: "max-w-prose", // 640px: long text
};

type ContainerProps = ComponentProps<"div"> & {
  width?: keyof typeof widths;
  as?: ElementType;
};

/**
 * Centres content and adds the page side padding: 16px on phones, 24px from
 * tablets up. Every template uses it, so page edges line up across the site.
 */
export function Container({
  width = "page",
  as: Tag = "div",
  className,
  ...props
}: ContainerProps) {
  return <Tag className={cx("mx-auto w-full px-4 md:px-6", widths[width], className)} {...props} />;
}
