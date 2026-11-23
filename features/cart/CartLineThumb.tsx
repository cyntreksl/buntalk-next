"use client";

import { useState } from "react";
import type { CartItem } from "./store";
import { cx } from "@/lib/utils";

/**
 * Small square picture for a cart line (BUN-176): the Cake Studio design's
 * preview, else the product photo, else the product's first letter. A picture
 * that fails to load falls back the same way.
 */
export function CartLineThumb({
  item,
  size = "md",
}: {
  item: Pick<CartItem, "name" | "imageUrl" | "customization">;
  size?: "sm" | "md";
}) {
  const src = item.customization?.previewUrl ?? item.imageUrl;
  const [failed, setFailed] = useState<string | null>(null);
  return (
    <span
      className={cx(
        "bg-accent-soft text-accent-soft-foreground font-display relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg font-bold",
        size === "md" ? "text-h3 size-20" : "text-h4 size-14",
      )}
    >
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element -- ERP / Cake Studio image hosts aren't set up for next/image yet
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={() => setFailed(src)}
        />
      ) : (
        <span aria-hidden="true">{item.name.charAt(0)}</span>
      )}
    </span>
  );
}
