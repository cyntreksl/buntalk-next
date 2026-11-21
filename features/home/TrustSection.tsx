import Link from "next/link";
import type { ReactNode } from "react";
import { BagIcon, MapPinIcon, CheckCircleIcon } from "@/components/ui";
import { contentPages } from "@/lib/content-pages";
import { siteConfig } from "@/lib/site-config";

function TrustItem({
  icon,
  title,
  children,
  link,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  link: { href: string; label: string };
}) {
  return (
    <li className="border-border bg-surface flex gap-4 rounded-lg border p-5">
      <span
        aria-hidden="true"
        className="bg-accent-soft text-accent-soft-foreground flex size-11 shrink-0 items-center justify-center rounded-full"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h3 className="text-h4">{title}</h3>
        <div className="text-body-sm text-muted-foreground">{children}</div>
        <Link href={link.href} className="text-body-sm text-primary mt-1 font-bold hover:underline">
          {link.label}
        </Link>
      </div>
    </li>
  );
}

const paymentLabels: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  "cash-on-delivery": "cash on delivery",
  "bank-transfer": "bank transfer",
  koko: "Koko",
  mintpay: "Mintpay",
};

/**
 * Delivery areas, outlets and payment options. Each item states only what is
 * set in lib/site-config.ts; until a detail is confirmed it shows a neutral
 * line and links to the page that will hold the details. No made-up claims.
 */
export function TrustSection() {
  const { deliveryAreas, outlets, paymentMethods } = siteConfig;

  return (
    <div>
      <h2 id="why-buntalk" className="sr-only">
        Delivery, outlets and payments
      </h2>
      <ul className="grid gap-4 md:grid-cols-3">
        <TrustItem
          icon={<BagIcon />}
          title="Delivery"
          link={{ href: contentPages.delivery.href, label: "Delivery information" }}
        >
          {deliveryAreas.length > 0
            ? `We deliver to ${deliveryAreas.join(", ")}.`
            : "See where we deliver and how much it costs."}
        </TrustItem>
        <TrustItem
          icon={<MapPinIcon />}
          title="Outlets"
          link={{ href: contentPages.outlets.href, label: "Find an outlet" }}
        >
          {outlets.length > 0
            ? `Visit us at ${outlets.length} outlet${outlets.length === 1 ? "" : "s"}.`
            : "Find a Buntalk outlet near you."}
        </TrustItem>
        <TrustItem
          icon={<CheckCircleIcon />}
          title="Payment options"
          link={{ href: contentPages.payment.href, label: "Payment information" }}
        >
          {paymentMethods.length > 0
            ? `Pay with ${paymentMethods.map((m) => paymentLabels[m]).join(", ")}.`
            : "See the ways you can pay."}
        </TrustItem>
      </ul>
    </div>
  );
}
