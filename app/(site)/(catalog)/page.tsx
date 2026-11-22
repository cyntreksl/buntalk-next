import { NewsletterSignup } from "@/components/layout/footer/NewsletterSignup";
import { FullWidthSection, FullWidthTemplate } from "@/components/layout/templates";
import { topLevelCategories } from "@/lib/categories";
import { ProductRail } from "@/features/catalog";
import { CakeStudioCta } from "@/features/home/CakeStudioCta";
import { FeaturedCategories } from "@/features/home/FeaturedCategories";
import { HeroBanners } from "@/features/home/HeroBanners";
import { PromoTiles } from "@/features/home/PromoTiles";
import { SectionHeading } from "@/features/home/SectionHeading";
import { TrustSection } from "@/features/home/TrustSection";
import {
  getCategories,
  getFeaturedProducts,
  getHomeBanners,
  getOfferProducts,
  getProductsByCategory,
} from "@/lib/erp";

// Same for every visitor: the complete page must be prerendered (stricter than
// the catalog layout's 'prefetch'). See app/(site)/(catalog)/layout.tsx.
export const ensureStatic = "navigation";

/** How many top-level categories get their own product row on the home page. */
const CATEGORY_ROWS = 2;

/**
 * Home page: full-width template, marketplace layout.
 *
 *   hero slider + deal tile · category circles · today's deals row ·
 *   three collection tiles · favourites row · a row per top category ·
 *   Cake Studio band · why Buntalk · newsletter
 *
 * Rendering: static + ISR (see README "Rendering strategy"). Every section
 * reads live ERP data through the cached reads in lib/erp, so the page is
 * prerendered as plain HTML and refreshed every 15 minutes, or immediately
 * when the ERP calls /api/revalidate.
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
  const topCategories = topLevelCategories(categories);
  const categoryRows = (
    await Promise.all(
      topCategories.slice(0, CATEGORY_ROWS).map(async (category) => ({
        category,
        products: await getProductsByCategory(category.slug),
      })),
    )
  ).filter((row) => row.products.length > 0);

  return (
    <FullWidthTemplate>
      <HeroBanners banners={banners} deals={offers} />

      {topCategories.length > 0 && (
        <FullWidthSection spacing="sm" aria-labelledby="categories">
          <FeaturedCategories categories={topCategories} />
        </FullWidthSection>
      )}

      {offers.length > 0 && (
        <FullWidthSection spacing="sm" aria-labelledby="offers">
          <SectionHeading id="offers" title="Today's best deals for you" />
          <ProductRail products={offers} />
        </FullWidthSection>
      )}

      {topCategories.length > 0 && (
        <FullWidthSection spacing="sm">
          <PromoTiles categories={topCategories} />
        </FullWidthSection>
      )}

      {featured.length > 0 && (
        <FullWidthSection spacing="sm" aria-labelledby="featured">
          <SectionHeading id="featured" title="Buntalk favourites" />
          <ProductRail products={featured} />
        </FullWidthSection>
      )}

      {categoryRows.map(({ category, products }) => (
        <FullWidthSection key={category.slug} spacing="sm" aria-labelledby={`row-${category.slug}`}>
          <SectionHeading
            id={`row-${category.slug}`}
            title={`Best of ${category.name}`}
            viewAll={{ href: `/category/${category.slug}`, label: "View all" }}
          />
          <ProductRail products={products} />
        </FullWidthSection>
      ))}

      <FullWidthSection spacing="sm" aria-labelledby="cake-studio">
        <CakeStudioCta />
      </FullWidthSection>

      <FullWidthSection spacing="sm" aria-labelledby="why-buntalk">
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
