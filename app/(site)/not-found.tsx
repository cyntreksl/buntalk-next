import type { Metadata } from "next";
import { NotFoundContent } from "@/features/content/NotFoundContent";

export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * 404 for notFound() inside storefront pages (missing product or category).
 * Renders inside the (site) layout, which already provides the header and
 * footer — see app/not-found.tsx for URLs that match no route.
 */
export default function SiteNotFound() {
  return <NotFoundContent />;
}
