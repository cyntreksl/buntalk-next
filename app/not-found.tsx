import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { SiteFooter } from "@/components/layout/footer/SiteFooter";
import { SiteHeader } from "@/components/layout/header/SiteHeader";
import { NotFoundContent } from "@/features/content/NotFoundContent";

export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * 404 for URLs that match no route at all. These skip the (site) layout, so
 * this page adds the site header and footer itself.
 *
 * notFound() called inside a (site) page (e.g. a product that no longer
 * exists) uses app/(site)/not-found.tsx instead, which is already inside the
 * site layout. Both return HTTP 404.
 */
export default function NotFound() {
  return (
    <PageShell header={<SiteHeader />} footer={<SiteFooter />}>
      <NotFoundContent />
    </PageShell>
  );
}
