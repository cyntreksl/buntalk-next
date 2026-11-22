import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { brand } from "@/lib/brand";
import { contentPages, policyPageIds } from "@/lib/content-pages";
import { getCopyrightYears } from "@/lib/copyright";
import { getNavigationCategories } from "@/lib/erp";
import { siteConfig } from "@/lib/site-config";
import { FooterContact } from "./FooterContact";
import { FooterLinkGroups, type FooterLinkGroup } from "./FooterLinkGroups";
import { NewsletterSignup } from "./NewsletterSignup";
import { PaymentMethods } from "./PaymentMethods";

/**
 * Storefront footer, shown on every (site) page.
 *
 *   Desktop: [logo + tagline | contact]  [newsletter]
 *            [Shop] [Customer help] [Company] [Policies]     ← link columns
 *            [policy links · payment badges · © line]
 *   Phone:   the same blocks stacked; the four link groups become accordions.
 *
 * Shop links come from the ERP categories (cached). Business details come from
 * lib/site-config.ts; page links from lib/content-pages.ts.
 */
export async function SiteFooter() {
  const [categories, years] = await Promise.all([getNavigationCategories(), getCopyrightYears()]);
  const page = (id: keyof typeof contentPages) => ({
    label: contentPages[id].title,
    href: contentPages[id].href,
  });

  const groups: FooterLinkGroup[] = [
    {
      id: "shop",
      title: "Shop",
      links: [
        ...categories.map((c) => ({ label: c.name, href: `/category/${c.slug}` })),
        { label: "Search products", href: "/search" },
      ],
    },
    {
      id: "help",
      title: "Customer help",
      links: [
        page("help"),
        page("contact"),
        { label: "Delivery information", href: contentPages.delivery.href },
        { label: "Returns and refunds", href: contentPages.refunds.href },
        { label: "My account", href: "/account" },
      ],
    },
    {
      id: "company",
      title: "Company",
      links: [
        page("about"),
        page("outlets"),
        { label: "Event tickets", href: siteConfig.externalLinks.tickets, external: true },
      ],
    },
    {
      id: "policies",
      title: "Policies",
      links: policyPageIds.map(page),
    },
  ];

  return (
    <footer className="border-border bg-surface-muted border-t">
      <div className="max-w-page mx-auto flex w-full flex-col gap-8 px-4 py-10 md:px-6 lg:py-14">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col gap-3">
            <Link href="/" aria-label="Buntalk home" className="self-start">
              <Logo variant="compact" height={48} />
            </Link>
            <p lang="si" className="font-sinhala text-heading text-body-lg">
              {brand.tagline}
            </p>
          </div>
          <FooterContact />
          {/* Hidden when the page already has its own newsletter section (e.g. the home page). */}
          <div className="md:col-span-2 lg:col-span-1 [body:has([data-newsletter-section])_&]:hidden">
            <NewsletterSignup id="footer-newsletter" />
          </div>
        </div>

        <FooterLinkGroups groups={groups} />

        <div className="border-border flex flex-col gap-4 border-t pt-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-2">
            {/* Always-visible policy links on phones, where the Policies group is a closed accordion. */}
            <nav aria-label="Policies (quick links)" className="lg:hidden">
              <ul className="text-caption text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                {policyPageIds.map((id) => (
                  <li key={id}>
                    <Link href={contentPages[id].href} className="hover:text-primary underline">
                      {contentPages[id].title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <p className="text-caption text-muted-foreground">
              © {years} {siteConfig.legalName}. All rights reserved.
              {siteConfig.poweredBy && <> Powered by {siteConfig.poweredBy.name}.</>}
            </p>
          </div>
          <PaymentMethods />
        </div>
      </div>
    </footer>
  );
}
