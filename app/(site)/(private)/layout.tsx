import type { Metadata } from "next";

/**
 * Per-user pages: cart and account. (Checkout follows the same rules in
 * app/(checkout)/layout.tsx, which adds its own minimal header.)
 *
 * Rendering: dynamic, never cached for other users.
 * - Anything per-user on the server (session, orders) reads cookies() inside
 *   <Suspense>, which makes that part render on every request.
 * - The cart itself lives only in the visitor's browser (Zustand + localStorage).
 * - next.config.ts sends `Cache-Control: private, no-store` for these paths so
 *   browsers, proxies and CDNs never store them.
 *
 * `ensureStatic = false` makes the build fail if a parent layout ever tries to
 * force these routes to be static.
 */
export const ensureStatic = false;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function PrivateLayout({ children }: LayoutProps<"/">) {
  return <>{children}</>;
}
