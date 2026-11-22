"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { buttonClasses, ChevronLeftIcon, ChevronRightIcon } from "@/components/ui";
import type { Banner } from "@/lib/erp";
import { cx } from "@/lib/utils";

/** Background for slides without a photo, in turn, so neighbouring slides differ. */
const tones = [
  "bg-secondary text-secondary-foreground",
  "bg-primary text-primary-foreground",
  "bg-surface-muted text-foreground",
];

function BannerLink({ banner, className }: { banner: Banner; className?: string }) {
  const external = /^https?:\/\//.test(banner.href);
  return external ? (
    <a href={banner.href} className={className} target="_blank" rel="noopener noreferrer">
      {banner.ctaLabel}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <Link href={banner.href} className={className}>
      {banner.ctaLabel}
    </Link>
  );
}

/**
 * Hero banners from the ERP as a swipeable slider.
 *
 * - Moves only when the visitor asks: swipe, the arrows, or the dots. No
 *   auto-rotation, which moves content people are reading and is hard to use
 *   with a keyboard or screen reader.
 * - Native horizontal scrolling with scroll-snap, so it works with touch,
 *   trackpads and the keyboard; the dots follow the scroll position.
 * - The first banner's title is the page's <h1>; the first image loads first.
 */
export function HeroCarousel({ banners, tagline }: { banners: Banner[]; tagline: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onScroll = () => setActive(Math.round(track.scrollLeft / track.clientWidth));
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const next = (index + banners.length) % banners.length;
    track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured"
      className="group relative flex flex-col gap-3"
    >
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto rounded-2xl [&::-webkit-scrollbar]:hidden"
      >
        {banners.map((banner, i) => (
          <div
            key={banner.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${banners.length}`}
            className={cx(
              "relative isolate flex min-h-72 w-full shrink-0 snap-start overflow-hidden md:min-h-80 lg:h-[22rem]",
              banner.imageUrl ? "bg-secondary text-secondary-foreground" : tones[i % tones.length],
            )}
          >
            {banner.imageUrl && (
              <>
                {/* TODO(BUN-159): add the ERP image host to images.remotePatterns and drop `unoptimized`. */}
                <Image
                  src={banner.imageUrl}
                  alt={banner.imageAlt ?? ""}
                  fill
                  priority={i === 0}
                  unoptimized
                  sizes="(min-width: 1024px) 760px, 100vw"
                  className="-z-10 object-cover"
                />
                <div
                  aria-hidden="true"
                  className="from-secondary via-secondary/70 absolute inset-0 -z-10 bg-linear-to-r to-transparent"
                />
              </>
            )}
            <div className="flex max-w-lg flex-col justify-center gap-3 p-7 md:p-10">
              {i === 0 && (
                <p lang="si" className="font-sinhala text-body-sm font-semibold opacity-90">
                  {tagline}
                </p>
              )}
              {i === 0 ? (
                <h1 id="home-hero-title" className="text-display text-current">
                  {banner.title}
                </h1>
              ) : (
                <h2 className="text-display text-current">{banner.title}</h2>
              )}
              {banner.subtitle && <p className="text-body-lg opacity-90">{banner.subtitle}</p>}
              <BannerLink
                banner={banner}
                className={buttonClasses({ className: "mt-2 self-start" })}
              />
            </div>
          </div>
        ))}
      </div>

      {banners.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(active - 1)}
            aria-label="Previous slide"
            className="bg-surface/90 text-foreground absolute top-[calc(50%-1rem)] left-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-opacity group-hover:opacity-100 focus-visible:opacity-100 md:inline-flex md:opacity-0"
          >
            <ChevronLeftIcon size={20} />
          </button>
          <button
            type="button"
            onClick={() => goTo(active + 1)}
            aria-label="Next slide"
            className="bg-surface/90 text-foreground absolute top-[calc(50%-1rem)] right-3 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-opacity group-hover:opacity-100 focus-visible:opacity-100 md:inline-flex md:opacity-0"
          >
            <ChevronRightIcon size={20} />
          </button>
          <div className="flex justify-center gap-1.5">
            {banners.map((banner, i) => (
              <button
                key={banner.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show slide ${i + 1}: ${banner.title}`}
                aria-current={i === active ? "true" : undefined}
                className={cx(
                  "h-2 rounded-full transition-all",
                  i === active
                    ? "bg-primary w-6"
                    : "bg-border-strong hover:bg-muted-foreground w-2",
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
