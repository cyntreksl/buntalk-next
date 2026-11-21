import Link from "next/link";
import { buttonClasses } from "@/components/ui";

/** Call-to-action for Cake Studio, the 3D cake designer (BUN-179 to BUN-183). */
export function CakeStudioCta() {
  return (
    <div className="rounded-brand bg-secondary text-secondary-foreground overflow-hidden">
      <div className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between md:p-10">
        <div className="flex max-w-prose flex-col gap-2">
          <p className="text-caption font-bold tracking-wider uppercase opacity-80">Cake Studio</p>
          <h2 id="cake-studio" className="text-h2 text-secondary-foreground">
            Design your own cake
          </h2>
          <p className="opacity-90">
            Choose the shape, flavour and decorations, and see your cake in 3D before you order.
          </p>
        </div>
        <Link
          href="/cake-studio"
          className={buttonClasses({
            size: "lg",
            variant: "outline",
            className: "shrink-0 self-start md:self-auto",
          })}
        >
          Open Cake Studio
        </Link>
      </div>
    </div>
  );
}
