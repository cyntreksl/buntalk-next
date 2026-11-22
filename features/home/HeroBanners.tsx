import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { buttonClasses } from "@/components/ui";
import { ProductImage } from "@/features/catalog";
import type { Banner, Product } from "@/lib/erp";
import { brand } from "@/lib/brand";
import { discountPercent } from "@/lib/pricing";
import { HeroCarousel } from "./HeroCarousel";

/** Shown when the ERP has no banners yet. */
const welcomeBanner: Banner = {
  id: "welcome",
  title: `Welcome to ${brand.name}`,
  subtitle: "Fresh from our kitchen to your door.",
  ctaLabel: "Shop by category",
  href: "#categories",
};

/**
 * The deal tile next to the hero: the ERP product with the biggest saving
 * right now ("Up to 25% off"). Without any deal, a Cake Studio tile instead.
 * Savings are the ERP's own prices (compare-at vs selling price).
 */
function SpotlightTile({ deals }: { deals: Product[] }) {
  const best = [...deals].sort((a, b) => discountPercent(b) - discountPercent(a))[0];
  const percent = best ? discountPercent(best) : 0;

  if (!best || percent === 0) {
    return (
      <div className="bg-secondary text-secondary-foreground flex min-h-56 flex-col justify-between gap-4 rounded-2xl p-7">
        <div className="flex flex-col gap-2">
          <p className="text-caption font-bold tracking-wider uppercase opacity-80">Cake Studio</p>
          <h2 className="text-h2 text-current">Design your own cake</h2>
          <p className="opacity-90">Choose the shape, flavour and decorations.</p>
        </div>
        <Link
          href="/cake-studio"
          className={buttonClasses({ variant: "outline", className: "self-start" })}
        >
          Start designing
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-accent-soft text-accent-soft-foreground group relative flex min-h-56 flex-col overflow-hidden rounded-2xl p-7">
      <p className="text-caption font-bold tracking-wider uppercase">Today&apos;s deal</p>
      <p className="text-display text-primary mt-1 leading-none">
        <span className="text-h3 block font-sans font-extrabold">Save</span>
        {percent}%
      </p>
      <h2 className="text-body-lg text-foreground mt-2 max-w-[60%] font-bold">
        <Link
          href={`/product/${best.slug}`}
          prefetch={true}
          className="after:absolute after:inset-0 after:rounded-2xl"
        >
          {best.name}
        </Link>
      </h2>
      <span className={buttonClasses({ size: "sm", className: "mt-auto self-start" })}>
        Shop now
      </span>
      <div className="absolute -right-6 -bottom-6 w-1/2 rotate-[-8deg] transition-transform duration-300 group-hover:rotate-0">
        <ProductImage product={best} variant="card" />
      </div>
    </div>
  );
}

/**
 * Top of the home page: the ERP hero banners as a slider (2/3 width on
 * desktop) and a deal spotlight tile (1/3). Stacked on phones.
 */
export function HeroBanners({ banners, deals }: { banners: Banner[]; deals: Product[] }) {
  return (
    <section aria-labelledby="home-hero-title">
      <Container className="grid gap-4 pt-4 pb-2 md:pt-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <HeroCarousel
            banners={banners.length > 0 ? banners : [welcomeBanner]}
            tagline={brand.tagline}
          />
        </div>
        <SpotlightTile deals={deals} />
      </Container>
    </section>
  );
}
