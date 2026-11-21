/**
 * Business details shown in the footer and on the contact / outlets pages.
 *
 * Only details confirmed on the old site (https://buntalk.lk, checked
 * 2026-11-22) are filled in. Everything else is left empty on purpose: the
 * footer hides any item that is empty, so no made-up phone numbers or links
 * appear on the site. Fill these in as Buntalk confirms them.
 *
 * Not taken from the old site because it showed template placeholders:
 * phone ("+94 123 456 7890"), email (hidden), About page text, policy texts.
 */

export type SocialNetwork = "facebook" | "instagram" | "tiktok" | "youtube" | "x" | "linkedin";

export type PaymentMethod =
  "visa" | "mastercard" | "amex" | "cash-on-delivery" | "bank-transfer" | "koko" | "mintpay";

export type Outlet = { name: string; address: string; phone?: string; mapUrl?: string };

export const siteConfig = {
  legalName: "Buntalk (Private) Limited",

  contact: {
    /** Shown as given and dialled as tel:+94… — e.g. "+94 77 123 4567". TODO: confirm with Buntalk. */
    phone: null as string | null,
    /** WhatsApp number in international format without spaces, e.g. "94771234567". TODO */
    whatsapp: null as string | null,
    /** TODO: confirm with Buntalk (hidden on the old site). */
    email: null as string | null,
    /** From the old site's contact page and footer. */
    address: "Katukurunda, Habaraduwa, Sri Lanka",
    /** e.g. "Mon–Sat, 8.00am – 8.00pm". TODO */
    openingHours: null as string | null,
  },

  /** Profile URLs. Empty = not shown. None were listed on the old site. TODO */
  social: {} as Partial<Record<SocialNetwork, string>>,

  /** Payment methods to show as badges. Empty = section hidden. TODO: confirm with the payment gateway work (BUN-203). */
  paymentMethods: [] as PaymentMethod[],

  /** Outlets for the outlet locator page. None were listed on the old site. TODO */
  outlets: [] as Outlet[],

  /** Areas Buntalk delivers to, shown on the home page trust section, e.g. ["Galle", "Matara"]. TODO */
  deliveryAreas: [] as string[],

  /** External links that exist today. */
  externalLinks: {
    tickets: "https://tickets.buntalk.lk/",
  },

  /** "Powered by" credit, as on the old site. Set to null to hide. */
  poweredBy: { name: "Cyntrek Solutions" } as { name: string } | null,

  /** First year for the copyright line. */
  copyrightStartYear: 2023,
};
