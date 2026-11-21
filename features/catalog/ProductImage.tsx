import type { Product } from "@/lib/erp";
import { cx } from "@/lib/utils";

/**
 * Product image area. The ERP doesn't provide images yet, so this shows a
 * branded placeholder with the same square shape a real photo will use
 * (so the layout won't shift when images arrive).
 *
 * - "detail": large, with the brand frame corners (product page)
 * - "card": fills the top of a product card
 */
export function ProductImage({
  product,
  variant = "detail",
}: {
  product: Pick<Product, "name">;
  variant?: "detail" | "card";
}) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "bg-accent-soft text-accent-soft-foreground font-display flex aspect-square w-full items-center justify-center font-bold select-none",
        variant === "detail" ? "rounded-brand text-[clamp(4rem,20vw,9rem)]" : "text-h1",
      )}
    >
      {product.name.charAt(0)}
    </div>
  );
}
