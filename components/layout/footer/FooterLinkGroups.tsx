import Link from "next/link";
import { ChevronDownIcon, ExternalLinkIcon } from "@/components/ui";

export type FooterLink = { label: string; href: string; external?: boolean };
export type FooterLinkGroup = { id: string; title: string; links: FooterLink[] };

function FooterLinkItem({ link }: { link: FooterLink }) {
  const classes =
    "text-body-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1 py-1";
  return link.external ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className={classes}>
      {link.label}
      <ExternalLinkIcon size={14} />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  ) : (
    <Link href={link.href} className={classes}>
      {link.label}
    </Link>
  );
}

/**
 * Footer link groups.
 *
 * - Phone/tablet (< lg): each group is an accordion (native <details>), so the
 *   footer stays short. Works with the keyboard and without JavaScript.
 * - Desktop (lg+): the groups are open columns.
 *
 * Both versions are rendered; CSS shows one. The hidden one uses display:none,
 * so screen readers only ever meet one copy.
 */
export function FooterLinkGroups({ groups }: { groups: FooterLinkGroup[] }) {
  return (
    <>
      <div className="divide-border border-border divide-y border-y lg:hidden">
        {groups.map((group) => (
          <details key={group.id} className="group">
            <summary className="text-body text-heading font-display flex cursor-pointer list-none items-center justify-between py-3.5 font-bold [&::-webkit-details-marker]:hidden">
              {group.title}
              <ChevronDownIcon className="text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <ul className="flex flex-col pb-3">
              {group.links.map((link) => (
                <li key={link.href}>
                  <FooterLinkItem link={link} />
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>

      <div className="hidden gap-8 lg:grid lg:grid-cols-4">
        {groups.map((group) => (
          <nav
            key={group.id}
            aria-labelledby={`footer-${group.id}`}
            className="flex flex-col gap-2"
          >
            <h2 id={`footer-${group.id}`} className="text-h4">
              {group.title}
            </h2>
            <ul className="flex flex-col">
              {group.links.map((link) => (
                <li key={link.href}>
                  <FooterLinkItem link={link} />
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </>
  );
}
