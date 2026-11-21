import type { Metadata } from "next";
import { ContentTemplate } from "@/components/layout/templates";
import { PendingContent } from "@/features/content/PendingContent";
import { contentPages } from "@/lib/content-pages";

const page = contentPages.refunds;

export const metadata: Metadata = {
  title: page.title,
  description: "When and how you can return an order and get a refund.",
};

export default function Page() {
  return (
    <ContentTemplate
      title={page.title}
      description="When and how you can return an order and get a refund."
      breadcrumb={[{ label: "Home", href: "/" }, { label: page.title }]}
    >
      <PendingContent what="refund and returns policy" />
    </ContentTemplate>
  );
}
