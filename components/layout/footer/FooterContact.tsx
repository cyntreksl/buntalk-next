import Link from "next/link";
import { ClockIcon, MailIcon, MapPinIcon, PhoneIcon } from "@/components/ui";
import { contentPages } from "@/lib/content-pages";
import { siteConfig } from "@/lib/site-config";

const socialLabels: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
};

/**
 * Contact details, outlet locator link and social links. Each item only
 * appears when it is set in lib/site-config.ts.
 */
export function FooterContact() {
  const { phone, whatsapp, email, address, openingHours } = siteConfig.contact;
  const social = Object.entries(siteConfig.social).filter(([, url]) => Boolean(url));
  const row = "text-body-sm text-muted-foreground flex items-start gap-2";

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-h4">Get in touch</h2>
      <address className="flex flex-col gap-2 not-italic">
        {address && (
          <p className={row}>
            <MapPinIcon size={18} className="mt-0.5 shrink-0" />
            <span>{address}</span>
          </p>
        )}
        {phone && (
          <p className={row}>
            <PhoneIcon size={18} className="mt-0.5 shrink-0" />
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="hover:text-primary">
              {phone}
            </a>
          </p>
        )}
        {whatsapp && (
          <p className={row}>
            <PhoneIcon size={18} className="mt-0.5 shrink-0" />
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
            >
              WhatsApp us<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        )}
        {email && (
          <p className={row}>
            <MailIcon size={18} className="mt-0.5 shrink-0" />
            <a href={`mailto:${email}`} className="hover:text-primary break-all">
              {email}
            </a>
          </p>
        )}
        {openingHours && (
          <p className={row}>
            <ClockIcon size={18} className="mt-0.5 shrink-0" />
            <span>{openingHours}</span>
          </p>
        )}
      </address>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link
          href={contentPages.contact.href}
          className="text-body-sm text-primary font-bold underline"
        >
          Contact us
        </Link>
        <Link
          href={contentPages.outlets.href}
          className="text-body-sm text-primary font-bold underline"
        >
          Find an outlet
        </Link>
      </div>
      {social.length > 0 && (
        <ul aria-label="Buntalk on social media" className="flex flex-wrap gap-2">
          {social.map(([network, url]) => (
            <li key={network}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border-strong text-body-sm hover:border-primary hover:text-primary inline-flex rounded-full border px-3 py-1 font-semibold"
              >
                {socialLabels[network] ?? network}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
