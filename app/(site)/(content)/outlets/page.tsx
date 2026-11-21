import type { Metadata } from "next";
import { ContentTemplate } from "@/components/layout/templates";
import { Card, CardTitle } from "@/components/ui";
import { PendingContent } from "@/features/content/PendingContent";
import { contentPages } from "@/lib/content-pages";
import { siteConfig } from "@/lib/site-config";

const page = contentPages.outlets;

export const metadata: Metadata = {
  title: page.title,
  description: "Find a Buntalk outlet near you.",
};

/** Outlet locator. Lists the outlets from lib/site-config.ts (empty until Buntalk supplies them). */
export default function OutletsPage() {
  const outlets = siteConfig.outlets;
  return (
    <ContentTemplate
      title={page.title}
      description="Find a Buntalk outlet near you."
      breadcrumb={[{ label: "Home", href: "/" }, { label: page.title }]}
    >
      {outlets.length === 0 ? (
        <PendingContent what="outlet list" />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {outlets.map((outlet) => (
            <li key={outlet.name}>
              <Card className="flex h-full flex-col gap-1">
                <CardTitle>{outlet.name}</CardTitle>
                <p className="text-body-sm text-muted-foreground">{outlet.address}</p>
                {outlet.phone && (
                  <a
                    href={`tel:${outlet.phone.replace(/\s/g, "")}`}
                    className="text-body-sm text-primary underline"
                  >
                    {outlet.phone}
                  </a>
                )}
                {outlet.mapUrl && (
                  <a
                    href={outlet.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-body-sm text-primary underline"
                  >
                    Open in maps<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </ContentTemplate>
  );
}
