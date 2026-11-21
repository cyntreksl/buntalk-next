import type { Metadata } from "next";
import { ContentTemplate } from "@/components/layout/templates";
import { PendingContent } from "@/features/content/PendingContent";
import { contentPages } from "@/lib/content-pages";

const page = contentPages.payment;

export const metadata: Metadata = {
  title: page.title,
  description: "The payment methods we accept and how payments are handled.",
};

export default function Page() {
  return (
    <ContentTemplate
      title={page.title}
      description="The payment methods we accept and how payments are handled."
      breadcrumb={[{ label: "Home", href: "/" }, { label: page.title }]}
    >
      <PendingContent what="payment policy" />
    </ContentTemplate>
  );
}
