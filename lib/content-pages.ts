/**
 * Information pages linked from the footer. One place for their paths and
 * titles, so the footer, the pages themselves and the old-URL redirects in
 * next.config.ts stay in sync.
 *
 * `oldPaths` are the addresses these pages had on the old buntalk.lk site;
 * they redirect permanently to the new page.
 */
export const contentPages = {
  about: { href: "/about", title: "About us", oldPaths: ["/page/about-us"] },
  contact: { href: "/contact", title: "Contact us", oldPaths: [] },
  help: { href: "/help", title: "Help & customer service", oldPaths: ["/page/customer-service"] },
  outlets: { href: "/outlets", title: "Outlet locator", oldPaths: [] },
  privacy: { href: "/privacy-policy", title: "Privacy policy", oldPaths: ["/page/privacy-policy"] },
  terms: {
    href: "/terms-and-conditions",
    title: "Terms and conditions",
    oldPaths: ["/page/terms-conditions", "/page/terms-of-use"],
  },
  refunds: {
    href: "/refund-policy",
    title: "Refund and returns policy",
    oldPaths: ["/page/refund-policy"],
  },
  delivery: {
    href: "/delivery-policy",
    title: "Delivery policy",
    oldPaths: ["/page/shipping-policy"],
  },
  payment: { href: "/payment-policy", title: "Payment policy", oldPaths: ["/page/payment-policy"] },
} as const;

export type ContentPageId = keyof typeof contentPages;

/** Policy pages, in the order they appear in the footer. */
export const policyPageIds = ["privacy", "terms", "refunds", "delivery", "payment"] as const;

/** Permanent redirects from the old site's URLs (used in next.config.ts). */
export const oldSiteRedirects = Object.values(contentPages).flatMap((page) =>
  page.oldPaths.map((source) => ({ source, destination: page.href, permanent: true })),
);
