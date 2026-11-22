"use client";

import { Container } from "@/components/layout/Container";
import { ErrorContent } from "@/components/feedback/ErrorContent";

/** Error boundary for checkout. Renders inside the minimal checkout header and footer. */
export default function CheckoutError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <Container width="content" className="py-10 md:py-16">
      <title>Something went wrong | Buntalk</title>
      <ErrorContent error={error} retry={retry} />
    </Container>
  );
}
