import type { ReactNode } from "react";
import { cx } from "@/lib/utils";
import { Container } from "../Container";

/**
 * Full-width template (home, landing pages): a stack of sections. Each
 * <FullWidthSection> spans the whole screen (so its background can run edge
 * to edge) while its content stays in the page container.
 */
export function FullWidthTemplate({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

const tones = {
  default: "",
  muted: "bg-surface-muted",
  brand: "bg-accent-soft",
  surface: "bg-surface",
};

type FullWidthSectionProps = {
  children: ReactNode;
  /** Background of the full-width band. */
  tone?: keyof typeof tones;
  /** Vertical space: "sm" for tight bands, "lg" for hero sections. */
  spacing?: "sm" | "md" | "lg";
  /** Let content run edge to edge (e.g. a banner image) instead of using the container. */
  bleed?: boolean;
  className?: string;
  "aria-labelledby"?: string;
  /** Marks the section as the page's newsletter section, so the footer hides its own copy. */
  "data-newsletter-section"?: string;
};

const spacings = { sm: "py-6 md:py-8", md: "py-10 md:py-14", lg: "py-12 md:py-20" };

export function FullWidthSection({
  children,
  tone = "default",
  spacing = "md",
  bleed = false,
  className,
  ...props
}: FullWidthSectionProps) {
  return (
    <section className={cx(tones[tone], spacings[spacing], className)} {...props}>
      {bleed ? children : <Container>{children}</Container>}
    </section>
  );
}
