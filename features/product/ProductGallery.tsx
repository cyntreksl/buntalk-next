"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronLeftIcon, ChevronRightIcon, Dialog, ZoomInIcon } from "@/components/ui";
import { ProductImage } from "@/features/catalog/ProductImage";
import type { Product } from "@/lib/erp";
import { cx } from "@/lib/utils";
import { defaultSkuId } from "@/lib/pricing";
import { useSelectedSku } from "./SelectedSku";

type GalleryProduct = Pick<Product, "name" | "imageUrls" | "skus">;

/** Photos to show: the picked size's own photo first (if it has one), then the product's. */
function galleryImages(product: GalleryProduct, skuId: string | undefined): string[] {
  const sku = product.skus?.find((s) => s.id === skuId);
  const urls = [sku?.imageUrl, ...(product.imageUrls ?? [])];
  return [...new Set(urls.filter((u): u is string => Boolean(u)))];
}

const arrowClasses =
  "bg-surface/90 text-foreground hover:bg-surface absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-opacity md:flex";

/**
 * Product photo gallery (BUN-171):
 * - one large photo, swipe sideways on phones (CSS scroll-snap), arrows on desktop;
 * - thumbnails under it to jump to a photo;
 * - click or tap a photo to open it large, then click to zoom in and move the
 *   pointer to look around;
 * - picking a size with its own photo shows that photo first.
 * A photo that fails to load is dropped; with none left, the branded placeholder shows.
 */
export function ProductGallery({ product }: { product: GalleryProduct }) {
  const { skuId } = useSelectedSku(defaultSkuId(product.skus));
  const [failed, setFailed] = useState<string[]>([]);
  const images = galleryImages(product, skuId).filter((u) => !failed.includes(u));
  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const first = images[0];

  const goTo = (i: number, behavior: ScrollBehavior = "smooth") => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: i * track.clientWidth, behavior });
  };

  // A different first photo (another size picked): show it.
  useEffect(() => {
    goTo(0, "instant");
  }, [first]);

  if (images.length === 0) {
    return <ProductImage product={{ name: product.name, imageUrls: [] }} />;
  }

  const count = images.length;
  const current = Math.min(index, count - 1);
  const label = (i: number) => (count > 1 ? `photo ${i + 1} of ${count}` : "photo");

  return (
    <div
      className="flex flex-col gap-3"
      role="region"
      aria-roledescription="carousel"
      aria-label={`Photos of ${product.name}`}
    >
      <div className="group relative">
        <div
          ref={trackRef}
          onScroll={(e) => {
            const t = e.currentTarget;
            setIndex(Math.round(t.scrollLeft / t.clientWidth));
          }}
          className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto overscroll-x-contain rounded-2xl [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, i) => (
            <div
              key={src}
              role="group"
              aria-roledescription="slide"
              aria-label={count > 1 ? `${i + 1} of ${count}` : undefined}
              className="bg-surface-muted relative aspect-square w-full shrink-0 snap-center"
            >
              <Image
                src={src}
                alt={i === 0 ? product.name : `${product.name}, ${label(i)}`}
                fill
                unoptimized
                priority={i === 0}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
                onError={() => setFailed((f) => [...f, src])}
              />
              <button
                type="button"
                onClick={() => {
                  setIndex(i);
                  setZoomOpen(true);
                }}
                aria-label={`Zoom in on ${label(i)}`}
                className="absolute inset-0 cursor-zoom-in"
              />
            </div>
          ))}
        </div>

        <span
          aria-hidden="true"
          className="bg-surface/90 text-foreground pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 shadow-sm"
        >
          <ZoomInIcon size={16} />
          {count > 1 && (
            <span className="text-caption font-bold">
              {current + 1} / {count}
            </span>
          )}
        </span>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              aria-label="Previous photo"
              className={cx(arrowClasses, "left-3 disabled:opacity-0")}
            >
              <ChevronLeftIcon />
            </button>
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              disabled={current === count - 1}
              aria-label="Next photo"
              className={cx(arrowClasses, "right-3 disabled:opacity-0")}
            >
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Choose a photo">
          {images.map((src, i) => (
            <li key={src} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show ${label(i)}`}
                aria-current={i === current || undefined}
                className={cx(
                  "bg-surface-muted relative block size-16 overflow-hidden rounded-lg border-2 transition-colors md:size-20",
                  i === current ? "border-primary" : "hover:border-border border-transparent",
                )}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  unoptimized
                  sizes="80px"
                  className="object-cover"
                  onError={() => setFailed((f) => [...f, src])}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ZoomDialog
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        name={product.name}
        images={images}
        index={current}
        onIndexChange={(i) => {
          setIndex(i);
          goTo(i, "instant");
        }}
      />
    </div>
  );
}

/** Large photo in a dialog. Click (or the button) to zoom in; move the pointer to look around. */
function ZoomDialog({
  open,
  onClose,
  name,
  images,
  index,
  onIndexChange,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  images: string[];
  index: number;
  onIndexChange: (i: number) => void;
}) {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const count = images.length;

  const show = (i: number) => {
    if (i < 0 || i >= count) return;
    setZoomed(false);
    onIndexChange(i);
  };

  // ← → move between photos while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const aim = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={() => {
        setZoomed(false);
        onClose();
      }}
      title={name}
      description={count > 1 ? `Photo ${index + 1} of ${count}` : undefined}
      className="md:max-w-3xl"
    >
      <div className="flex flex-col gap-3">
        <div
          onClick={(e) => {
            aim(e);
            setZoomed((z) => !z);
          }}
          onPointerMove={(e) => zoomed && aim(e)}
          className={cx(
            "bg-surface-muted relative mx-auto aspect-square w-full max-w-[min(100%,calc(85vh-11rem))] overflow-hidden rounded-xl",
            zoomed ? "cursor-zoom-out" : "cursor-zoom-in",
          )}
        >
          {images[index] && (
            <Image
              src={images[index]}
              alt={name}
              fill
              unoptimized
              sizes="(min-width: 768px) 768px, 100vw"
              className="object-contain transition-transform duration-200"
              style={{
                transform: zoomed ? "scale(2.5)" : "none",
                transformOrigin: `${origin.x}% ${origin.y}%`,
              }}
            />
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => show(index - 1)}
            disabled={index === 0}
            aria-label="Previous photo"
            className="hover:bg-surface-muted flex size-10 items-center justify-center rounded-full disabled:opacity-30"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => setZoomed((z) => !z)}
            aria-pressed={zoomed}
            className="text-body-sm hover:bg-surface-muted flex items-center gap-2 rounded-full px-4 py-2 font-bold"
          >
            <ZoomInIcon size={18} />
            {zoomed ? "Zoom out" : "Zoom in"}
          </button>
          <button
            type="button"
            onClick={() => show(index + 1)}
            disabled={index === count - 1}
            aria-label="Next photo"
            className="hover:bg-surface-muted flex size-10 items-center justify-center rounded-full disabled:opacity-30"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>
    </Dialog>
  );
}
