import { Button } from "@/components/ui";
import { cx } from "@/lib/utils";

/**
 * Newsletter sign-up slot, used in the footer and as a home page section.
 * The form is disabled until a mailing-list service is chosen and connected
 * (no ticket yet), so it never pretends to subscribe anyone.
 *
 * `id` must be unique on the page (the footer and home page both show one).
 */
export function NewsletterSignup({
  id = "newsletter",
  size = "sm",
}: {
  id?: string;
  /** "lg" for the larger home page section. */
  size?: "sm" | "lg";
}) {
  return (
    <section data-slot="newsletter" aria-labelledby={`${id}-title`} className="flex flex-col gap-3">
      <h2 id={`${id}-title`} className={size === "lg" ? "text-h2" : "text-h4"}>
        Stay in the loop
      </h2>
      <p className={cx("text-muted-foreground", size === "lg" ? "text-body" : "text-body-sm")}>
        News, offers and new arrivals from Buntalk. Newsletter sign-up is coming soon.
      </p>
      <form className="flex gap-2" aria-describedby={`${id}-status`}>
        <label htmlFor={`${id}-email`} className="sr-only">
          Email address
        </label>
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          placeholder="Your email address"
          disabled
          className="border-border-strong bg-surface text-body h-10 w-full min-w-0 rounded-sm border px-3 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <Button type="submit" size="sm" className="h-10" disabled>
          Subscribe
        </Button>
      </form>
      <p id={`${id}-status`} className="sr-only">
        Sign-up is not available yet.
      </p>
    </section>
  );
}
