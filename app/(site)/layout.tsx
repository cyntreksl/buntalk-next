import { PageShell } from "@/components/layout/PageShell";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

/** Main storefront: full header with navigation, and the full footer. */
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <PageShell header={<SiteHeader />} footer={<SiteFooter />}>
      {children}
    </PageShell>
  );
}
