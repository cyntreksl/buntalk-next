import type { Product } from "@/lib/erp";

/**
 * Product image area. The ERP doesn't provide images yet, so this shows a
 * branded placeholder with the same square shape a real photo will use
 * (so the layout won't shift when images arrive).
 */
export function ProductImage({ product }: { product: Pick<Product, "name"> }) {
  return (
    <div
      aria-hidden="true"
      className="rounded-brand bg-accent-soft text-accent-soft-foreground font-display flex aspect-square w-full items-center justify-center text-[clamp(4rem,20vw,9rem)] font-bold select-none"
    >
      {product.name.charAt(0)}
    </div>
  );
}
