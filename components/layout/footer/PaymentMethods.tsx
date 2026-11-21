import { siteConfig, type PaymentMethod } from "@/lib/site-config";

const labels: Record<PaymentMethod, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  "cash-on-delivery": "Cash on delivery",
  "bank-transfer": "Bank transfer",
  koko: "Koko",
  mintpay: "Mintpay",
};

/**
 * Accepted payment methods as text badges. Hidden until methods are set in
 * lib/site-config.ts. (Official card-brand logos can replace the text badges
 * once the payment provider confirms which brands are accepted.)
 */
export function PaymentMethods() {
  const methods = siteConfig.paymentMethods;
  if (methods.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-caption text-muted-foreground font-bold tracking-wider uppercase">
        We accept
      </h2>
      <ul className="flex flex-wrap gap-2">
        {methods.map((method) => (
          <li
            key={method}
            className="border-border-strong bg-surface text-caption text-foreground rounded-sm border px-2 py-1 font-bold"
          >
            {labels[method]}
          </li>
        ))}
      </ul>
    </div>
  );
}
