import type { Metadata } from "next";
import { ContentTemplate } from "@/components/layout/templates";
import { PendingContent } from "@/features/content/PendingContent";
import { contentPages } from "@/lib/content-pages";

const page = contentPages.terms;

export const metadata: Metadata = {
  title: page.title,
  description: "The terms that apply when you use this website and place an order.",
};

export default function Page() {
  return (
    <ContentTemplate
      title={page.title}
      description="The terms that apply when you use this website and place an order."
      breadcrumb={[{ label: "Home", href: "/" }, { label: page.title }]}
    >
      <PendingContent what="terms and conditions" />
    </ContentTemplate>
  );
}
