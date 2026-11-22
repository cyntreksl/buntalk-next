import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { buttonClasses } from "@/components/ui";
import type { Banner } from "@/lib/erp";
import { brand } from "@/lib/brand";
import { cx } from "@/lib/utils";

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
 * Banner image. ERP image hosts aren't known yet, so images are served as-is
 * (`unoptimized`). TODO(BUN-159): add the ERP image host to
 * `images.remotePatterns` in next.config.ts and drop `unoptimized` to get
 * resized, modern-format images.
 */
function BannerImage({ banner, priority }: { banner: Banner; priority?: boolean }) {
  if (!banner.imageUrl) return null;
  return (
    <Image
      src={banner.imageUrl}
      alt={banner.imageAlt ?? ""}
      fill
      priority={priority}
      unoptimized
      sizes="(min-width: 1024px) 1152px, 100vw"
      className="object-cover"
    />
  );
}

/**
 * Hero and promotional banners from the ERP.
 *
 * - The first banner is the hero: full width, the page's <h1>, loaded first.
 * - Further banners show as a row of smaller promo cards underneath.
 * - No auto-rotating carousel: it slows mobile pages, moves content people are
 *   reading, and is hard to use with a keyboard or screen reader.
 * - With no banners from the ERP, a branded welcome hero is shown instead.
 */
export function HeroBanners({ banners }: { banners: Banner[] }) {
  const [hero, ...promos] = banners;

  return (
    <section aria-labelledby="home-hero-title" className="bg-accent-soft">
      <Container className="flex flex-col gap-4 py-6 md:gap-6 md:py-10">
        <div className="rounded-brand bg-surface relative isolate overflow-hidden shadow-sm">
          {hero && <BannerImage banner={hero} priority />}
          <div
            className={cx(
              "relative flex min-h-64 max-w-2xl flex-col justify-center gap-3 p-6 md:min-h-80 md:p-12",
              hero?.imageUrl &&
                "from-surface via-surface/85 bg-linear-to-r to-transparent md:max-w-none md:pr-[40%]",
            )}
          >
            <p lang="si" className="font-sinhala text-body-lg text-heading">
              {brand.tagline}
            </p>
            <h1 id="home-hero-title" className="text-display">
              {hero?.title ?? `Welcome to ${brand.name}`}
            </h1>
            {(hero?.subtitle ?? !hero) && (
              <p className="text-body-lg text-muted-foreground max-w-prose">
                {hero?.subtitle ?? "Fresh from our kitchen to your door."}
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              {hero ? (
                <BannerLink banner={hero} className={buttonClasses({ size: "lg" })} />
              ) : (
                <Link href="#categories" className={buttonClasses({ size: "lg" })}>
                  Shop by category
                </Link>
              )}
            </div>
          </div>
        </div>

        {promos.length > 0 && (
          <ul className="grid gap-4 md:grid-cols-2">
            {promos.slice(0, 2).map((banner) => (
              <li
                key={banner.id}
                className="rounded-brand bg-secondary text-secondary-foreground relative isolate overflow-hidden"
              >
                <BannerImage banner={banner} />
                <div className="relative flex min-h-36 flex-col justify-center gap-2 p-6">
                  <h2 className="text-h3 text-secondary-foreground">{banner.title}</h2>
                  {banner.subtitle && <p className="text-body-sm opacity-90">{banner.subtitle}</p>}
                  <BannerLink
                    banner={banner}
                    className="text-body-sm self-start font-bold underline underline-offset-4"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Container>
    </section>
  );
}
