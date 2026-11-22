"use client";

import Image from "next/image";
import { useState } from "react";
import type { Product } from "@/lib/erp";
import { cx } from "@/lib/utils";

type ProductImageProps = {
  product: Pick<Product, "name" | "imageUrls">;
  /** "detail": large, brand-frame corners (product page). "card": top of a product card. */
  variant?: "detail" | "card";
  /** Load early: use for the main image on a product page. */
  priority?: boolean;
};

function Placeholder({ name, variant }: { name: string; variant: "detail" | "card" }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        "bg-accent-soft text-accent-soft-foreground font-display flex size-full items-center justify-center font-bold select-none",
        variant === "detail" ? "text-[clamp(4rem,20vw,9rem)]" : "text-h1",
      )}
    >
      {name.charAt(0)}
    </div>
  );
}

/**
 * Product photo from the ERP, in a square frame.
 *
 * If the product has no image, or the image fails to load (deleted file,
 * wrong URL, image host down), a branded placeholder with the product's
 * initial is shown instead. The square frame is the same either way, so the
 * page layout never jumps.
 *
 * ERP image hosts aren't configured for Next.js image optimisation yet, so
 * images are served as-is (`unoptimized`). TODO: add the ERP image host to
 * images.remotePatterns in next.config.ts and drop `unoptimized`
 * (docs/erp-api-contract.md, open question 4).
 */
export function ProductImage({ product, variant = "detail", priority }: ProductImageProps) {
  const src = product.imageUrls?.[0];
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src !== undefined && failedSrc !== src;

  return (
    <div
      className={cx(
        "bg-surface-muted relative aspect-square w-full overflow-hidden",
        variant === "detail" ? "rounded-2xl" : "rounded-xl",
      )}
    >
      {showImage ? (
        <Image
          src={src}
          alt={product.name}
          fill
          unoptimized
          priority={priority}
          sizes={
            variant === "detail"
              ? "(min-width: 768px) 50vw, 100vw"
              : "(min-width: 1024px) 25vw, 50vw"
          }
          className="object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Placeholder name={product.name} variant={variant} />
      )}
    </div>
  );
}
