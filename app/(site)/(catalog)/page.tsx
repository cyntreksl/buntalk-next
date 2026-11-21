import { NewsletterSignup } from "@/components/layout/footer/NewsletterSignup";
import { FullWidthSection, FullWidthTemplate } from "@/components/layout/templates";
import { ProductGrid } from "@/features/catalog";
import { CakeStudioCta } from "@/features/home/CakeStudioCta";
import { FeaturedCategories } from "@/features/home/FeaturedCategories";
import { HeroBanners } from "@/features/home/HeroBanners";
import { SectionHeading } from "@/features/home/SectionHeading";
import { TrustSection } from "@/features/home/TrustSection";
import { getCategories, getFeaturedProducts, getHomeBanners, getOfferProducts } from "@/lib/erp";

/**
 * Home page: full-width template.
 *
 * Rendering: static + ISR (see README "Rendering strategy"). Every section
 * reads live ERP data through the cached reads in lib/erp — banners,
 * categories, offers, featured products — so the page is prerendered as plain
 * HTML and refreshed every 15 minutes, or immediately when the ERP calls
 * /api/revalidate with { "type": "home" }.
 *
 * Sections with no data are left out rather than shown empty.
 */
export default async function HomePage() {
  const [banners, categories, offers, featured] = await Promise.all([
    getHomeBanners(),
    getCategories(),
    getOfferProducts(),
    getFeaturedProducts(),
  ]);

  return (
    <FullWidthTemplate>
      <HeroBanners banners={banners} />

      {categories.length > 0 && (
        <FullWidthSection aria-labelledby="categories">
          <FeaturedCategories categories={categories} />
        </FullWidthSection>
      )}

      {offers.length > 0 && (
        <FullWidthSection tone="muted" aria-labelledby="offers">
          <SectionHeading
            id="offers"
            title="Current offers"
            description="Limited-time prices on Buntalk favourites."
          />
          <ProductGrid products={offers.slice(0, 8)} />
        </FullWidthSection>
      )}

      {featured.length > 0 && (
        <FullWidthSection aria-labelledby="featured">
          <SectionHeading id="featured" title="Featured" />
          <ProductGrid products={featured.slice(0, 8)} />
        </FullWidthSection>
      )}

      <FullWidthSection spacing="sm" aria-labelledby="cake-studio">
        <CakeStudioCta />
      </FullWidthSection>

      <FullWidthSection aria-labelledby="why-buntalk">
        <TrustSection />
      </FullWidthSection>

      <FullWidthSection tone="brand" data-newsletter-section="">
        <div className="mx-auto max-w-xl">
          <NewsletterSignup id="home-newsletter" size="lg" />
        </div>
      </FullWidthSection>
    </FullWidthTemplate>
  );
}
