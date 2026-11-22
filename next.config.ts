import type { NextConfig } from "next";
import { oldSiteRedirects } from "./lib/content-pages";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Paths that show per-user data. Browsers, proxies and CDNs must never store them. */
const PRIVATE_PATHS = ["/cart", "/checkout", "/account"];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,

  /**
   * Cache lifetimes per page type (see "Rendering strategy" in the README).
   * stale:      how long the browser reuses a page without asking the server
   * revalidate: after this, the next visit is served the cached page and a fresh copy is built in the background
   * expire:     after this with no visits, the next visit waits for a fresh copy
   *
   * A page refreshes as often as the shortest-lived data it shows.
   */
  cacheLife: {
    // Home, category and product pages: names, descriptions, prices from the ERP
    catalog: { stale: 5 * MINUTE, revalidate: 15 * MINUTE, expire: DAY },
    // Search results per query
    search: { stale: MINUTE, revalidate: 5 * MINUTE, expire: HOUR },
    // Active schemes / offers. Short, so a new offer shows soon even without the webhook.
    // Ending offers are also hidden in the browser at their end time (OfferBadges), and the
    // cart is always priced live by the ERP, so an expired offer is never applied.
    schemes: { stale: MINUTE, revalidate: 5 * MINUTE, expire: HOUR },
  },

  /** Old buntalk.lk page addresses → new pages (see lib/content-pages.ts). */
  async redirects() {
    return oldSiteRedirects;
  },

  async headers() {
    return [
      ...PRIVATE_PATHS.flatMap((path) => [path, `${path}/:rest*`]).map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      })),
      {
        source: "/api/revalidate",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
