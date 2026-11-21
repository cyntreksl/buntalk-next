import type { Metadata } from "next";
import { ContentTemplate } from "@/components/layout/templates";
import { Card } from "@/components/ui";
import { contentPages } from "@/lib/content-pages";
import { siteConfig } from "@/lib/site-config";

const page = contentPages.contact;

export const metadata: Metadata = {
  title: page.title,
  description: "How to reach Buntalk.",
};

export default function ContactPage() {
  const { phone, whatsapp, email, address, openingHours } = siteConfig.contact;
  const items = [
    address && { label: "Address", value: address },
    phone && { label: "Phone", value: phone, href: `tel:${phone.replace(/\s/g, "")}` },
    whatsapp && { label: "WhatsApp", value: `+${whatsapp}`, href: `https://wa.me/${whatsapp}` },
    email && { label: "Email", value: email, href: `mailto:${email}` },
    openingHours && { label: "Opening hours", value: openingHours },
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  return (
    <ContentTemplate
      title={page.title}
      description="We're happy to help with orders, delivery and anything else."
      breadcrumb={[{ label: "Home", href: "/" }, { label: page.title }]}
    >
      <Card padding="lg">
        <dl className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          {items.map((item) => (
            <div key={item.label} className="contents">
              <dt className="font-bold">{item.label}</dt>
              <dd className="text-muted-foreground break-words">
                {item.href ? (
                  <a href={item.href} className="text-primary underline">
                    {item.value}
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
        {!phone && !email && (
          <p className="text-body-sm text-muted-foreground mt-4">
            Phone and email details will be added here soon.
          </p>
        )}
      </Card>
    </ContentTemplate>
  );
}
