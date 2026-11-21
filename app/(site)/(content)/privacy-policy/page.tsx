import type { Metadata } from "next";
import { ContentTemplate } from "@/components/layout/templates";
import { PendingContent } from "@/features/content/PendingContent";
import { contentPages } from "@/lib/content-pages";

const page = contentPages.privacy;

export const metadata: Metadata = {
  title: page.title,
  description: "How Buntalk collects, uses and protects your personal information.",
};

export default function Page() {
  return (
    <ContentTemplate
      title={page.title}
      description="How Buntalk collects, uses and protects your personal information."
      breadcrumb={[{ label: "Home", href: "/" }, { label: page.title }]}
    >
      <PendingContent what="privacy policy" />
    </ContentTemplate>
  );
}
