import Link from "next/link";
import { buttonClasses } from "@/components/ui";

const steps = ["Pick a shape", "Choose a flavour", "Add decorations", "See it in 3D"];

/**
 * Cake Studio band: a wide, soft panel with the call to action in the middle
 * and the four steps as chips (BUN-179 to BUN-183).
 */
export function CakeStudioCta() {
  return (
    <div className="border-border from-accent-soft via-surface to-accent-soft relative overflow-hidden rounded-2xl border bg-linear-to-r px-6 py-10 text-center md:py-14">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3">
        <p className="text-caption text-primary font-bold tracking-wider uppercase">Cake Studio</p>
        <h2 id="cake-studio" className="text-h1 text-foreground">
          Design your own cake
        </h2>
        <p className="text-muted-foreground">
          Choose the shape, flavour and decorations, and see your cake in 3D before you order.
        </p>
        <ul className="mt-1 flex flex-wrap justify-center gap-2">
          {steps.map((step) => (
            <li
              key={step}
              className="bg-surface border-border text-body-sm rounded-full border px-3 py-1 font-semibold"
            >
              {step}
            </li>
          ))}
        </ul>
        <Link href="/cake-studio" className={buttonClasses({ size: "lg", className: "mt-3" })}>
          Open Cake Studio
        </Link>
      </div>
    </div>
  );
}
