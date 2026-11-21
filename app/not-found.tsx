import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { PageShell } from "@/components/layout/PageShell";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/header/SiteHeader";
import { buttonClasses } from "@/components/ui";

/** 404 page, shown inside the normal site header and footer. */
export default function NotFound() {
  return (
    <PageShell header={<SiteHeader />} footer={<SiteFooter />}>
      <Container width="content" className="flex flex-col items-start gap-4 py-16 md:py-24">
        <p className="text-caption text-primary font-bold tracking-wider uppercase">404</p>
        <h1 className="text-h1">We couldn&apos;t find that page</h1>
        <p className="text-muted-foreground max-w-prose">
          The link may be old, or the product may no longer be available.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link href="/" className={buttonClasses()}>
            Go to the home page
          </Link>
          <Link href="/search" className={buttonClasses({ variant: "outline" })}>
            Search products
          </Link>
        </div>
      </Container>
    </PageShell>
  );
}
