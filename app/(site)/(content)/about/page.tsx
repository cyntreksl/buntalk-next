import type { Metadata } from "next";
import { ContentTemplate } from "@/components/layout/templates";
import { PendingContent } from "@/features/content/PendingContent";
import { contentPages } from "@/lib/content-pages";

const page = contentPages.about;

export const metadata: Metadata = {
  title: page.title,
  description: "Who we are and what Buntalk is about.",
};

export default function Page() {
  return (
    <ContentTemplate
      title={page.title}
      description="Who we are and what Buntalk is about."
      breadcrumb={[{ label: "Home", href: "/" }, { label: page.title }]}
    >
      <PendingContent what="company story" />
    </ContentTemplate>
  );
}
