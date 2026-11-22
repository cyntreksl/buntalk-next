"use client";

import { Container } from "@/components/layout/Container";
import { ErrorContent } from "@/components/feedback/ErrorContent";

/**
 * Error boundary for storefront pages (500 / ERP unavailable). Renders inside
 * the site header and footer, so visitors can still navigate away.
 */
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Container width="content" className="py-10 md:py-16">
      <title>Something went wrong | Buntalk</title>
      <ErrorContent error={error} retry={retry} />
    </Container>
  );
}
