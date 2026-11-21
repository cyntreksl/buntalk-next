import type { Metadata } from "next";
import { ContentTemplate } from "@/components/layout/templates";
import { PendingContent } from "@/features/content/PendingContent";
import { contentPages } from "@/lib/content-pages";

const page = contentPages.delivery;

export const metadata: Metadata = {
  title: page.title,
  description: "Where we deliver, how long it takes and what it costs.",
};

export default function Page() {
  return (
    <ContentTemplate
      title={page.title}
      description="Where we deliver, how long it takes and what it costs."
      breadcrumb={[{ label: "Home", href: "/" }, { label: page.title }]}
    >
      <PendingContent what="delivery policy" />
    </ContentTemplate>
  );
}
