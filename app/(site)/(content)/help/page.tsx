import type { Metadata } from "next";
import { ContentTemplate } from "@/components/layout/templates";
import { PendingContent } from "@/features/content/PendingContent";
import { contentPages } from "@/lib/content-pages";

const page = contentPages.help;

export const metadata: Metadata = {
  title: page.title,
  description: "Answers to common questions about orders, delivery and your account.",
};

export default function Page() {
  return (
    <ContentTemplate
      title={page.title}
      description="Answers to common questions about orders, delivery and your account."
      breadcrumb={[{ label: "Home", href: "/" }, { label: page.title }]}
    >
      <PendingContent what="help and customer service information" />
    </ContentTemplate>
  );
}
