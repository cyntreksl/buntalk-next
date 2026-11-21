import { Button } from "@/components/ui";

/**
 * Newsletter sign-up slot. Holds the footer space and layout for the sign-up
 * form. The form is disabled until a mailing-list service is chosen and
 * connected (no ticket yet), so it never pretends to subscribe anyone.
 */
export function NewsletterSignup() {
  return (
    <section
      data-slot="newsletter"
      aria-labelledby="newsletter-title"
      className="flex flex-col gap-3"
    >
      <h2 id="newsletter-title" className="text-h4">
        Stay in the loop
      </h2>
      <p className="text-body-sm text-muted-foreground">
        News, offers and new arrivals from Buntalk. Newsletter sign-up is coming soon.
      </p>
      <form className="flex gap-2" aria-describedby="newsletter-status">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
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
      <p id="newsletter-status" className="sr-only">
        Sign-up is not available yet.
      </p>
    </section>
  );
}
