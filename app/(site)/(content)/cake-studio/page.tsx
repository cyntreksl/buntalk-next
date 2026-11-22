import type { Metadata } from "next";
import { ContentTemplate } from "@/components/layout/templates";
import { Card } from "@/components/ui";

export const metadata: Metadata = {
  title: "Cake Studio",
  description: "Design your own cake and see it in 3D before you order.",
};

/**
 * Cake Studio landing page. The 3D designer itself is built in BUN-179 to
 * BUN-183; this page is where the home page call-to-action points until then.
 */
export default function CakeStudioPage() {
  return (
    <ContentTemplate
      title="Cake Studio"
      description="Design your own cake and see it in 3D before you order."
      breadcrumb={[{ label: "Home", href: "/" }, { label: "Cake Studio" }]}
    >
      <Card padding="lg" className="flex flex-col gap-2">
        <p className="font-bold">Cake Studio is coming soon.</p>
        <p className="text-muted-foreground">
          Soon you&apos;ll be able to choose your cake&apos;s shape, flavour and decorations, see it
          in 3D, and order it online.
        </p>
      </Card>
    </ContentTemplate>
  );
}
