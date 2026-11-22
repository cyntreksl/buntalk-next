import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailTemplate } from "@/components/layout/templates";
import { ProductPurchase } from "@/features/cart";
import { OfferList, ProductRail } from "@/features/catalog";
import { CustomerPricesProvider } from "@/features/catalog/CustomerPrices";
import { EarliestReady, ProductGallery, SelectedSkuProvider } from "@/features/product";
import { categoryTrail } from "@/lib/categories";
import { defaultSkuId } from "@/lib/pricing";
import { formatWeight } from "@/lib/utils";
import { getCategories, getFeaturedProducts, getProduct, getProductsByCategory } from "@/lib/erp";

// Product: detail template. Static + ISR, "catalog" cache profile (refreshes every 15 min) — see README.

// The page reads `params` before rendering so its HTML is always complete
// (no loading placeholder, see the (catalog) layout). That intentionally blocks
// on the URL, so skip Next's dev-time "instant navigation" check for it.
// Links to products use prefetch={true}, so navigations are still fast.
export const instant = false;

// Same for every visitor: the complete page must be prerendered (stricter than
// the catalog layout's 'prefetch'). See app/(site)/(catalog)/layout.tsx.
export const ensureStatic = "navigation";

/**
 * Prerender only the featured products at build time, to keep builds fast.
 * Every other product is built on its first visit and then served from the cache.
 */
/** How many products "You may also like" shows (one row of five on desktop, more to swipe on phones). */
const RELATED_COUNT = 10;

export async function generateStaticParams() {
  const products = await getFeaturedProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Page not found" };
  return { title: product.name, description: product.description };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  // Category and its parents, for the breadcrumb (Home › Cakes › Birthday cakes › …).
  const trail = categoryTrail(await getCategories(), product.categorySlug);
  const category = trail.at(-1);
  // "You may also like": other products in the same category (cached read), in ERP order.
  const related = (await getProductsByCategory(product.categorySlug))
    .filter((p) => p.slug !== product.slug)
    .slice(0, RELATED_COUNT);
  const readyIn = product.processingTimeHours
    ? formatProcessingTime(product.processingTimeHours)
    : null;

  // Short text by the price; the full description under "Product details".
  // Until the ERP sends short_description (BUN-257), the description is shown
  // there too, cut to three lines with a link down to the rest.
  const summaryText = product.shortDescription ?? product.description;
  const clipSummary = !product.shortDescription && product.description.length > 160;

  const details = [
    product.code && { label: "Item code", value: product.code },
    category && { label: "Category", value: category.name },
    product.netWeightGrams && { label: "Net weight", value: formatWeight(product.netWeightGrams) },
    product.servings && { label: "Servings", value: `Serves ${product.servings}` },
    ...(product.attributes ?? []).map((a) => ({ label: a.name, value: a.values.join(", ") })),
    readyIn && { label: "Preparation time", value: readyIn },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    // Shares the picked size between the size picker and the gallery (photo per size).
    <SelectedSkuProvider initialSkuId={defaultSkuId(product.skus)}>
      <CustomerPricesProvider slugs={[product.slug]}>
        <DetailTemplate
          breadcrumb={[
            { label: "Home", href: "/" },
            ...trail.map((c) => ({ label: c.name, href: `/category/${c.slug}` })),
            { label: product.name },
          ]}
          media={
            <ProductGallery
              product={{ name: product.name, imageUrls: product.imageUrls, skus: product.skus }}
            />
          }
          summary={
            <>
              <div className="flex flex-col gap-2">
                <h1 className="text-h1 break-words">{product.name}</h1>
                {summaryText && (
                  <p
                    className={
                      clipSummary ? "text-muted-foreground line-clamp-3" : "text-muted-foreground"
                    }
                  >
                    {summaryText}
                  </p>
                )}
                {(clipSummary || product.shortDescription) && product.description && (
                  <a
                    href="#product-details"
                    className="text-body-sm text-primary font-bold underline-offset-4 hover:underline"
                  >
                    Read more
                  </a>
                )}
              </div>
              {/* Price (per size), size picker and add to cart, or "Customize in Cake Studio".
              Prices are the ERP's online prices. */}
              <ProductPurchase product={product} />
              {product.processingTimeHours && readyIn && (
                <EarliestReady hours={product.processingTimeHours} readyIn={readyIn} />
              )}
              {/* ERP scheme offers on this product. Applied by the ERP in the cart, never here. */}
              {product.offers && product.offers.length > 0 && (
                <OfferList offers={product.offers} currency={product.currency} />
              )}
            </>
          }
        >
          <div className="flex flex-col gap-10 md:gap-14">
            <section aria-labelledby="product-details" className="flex max-w-prose flex-col gap-4">
              <h2 id="product-details" className="text-h3 scroll-mt-(--sticky-offset)">
                Product details
              </h2>
              {product.description && <p>{product.description}</p>}
              {details.length > 0 && (
                <dl className="border-border divide-border divide-y border-y">
                  {details.map((d) => (
                    <div
                      key={d.label}
                      className="grid grid-cols-[10rem_minmax(0,1fr)] gap-4 py-2.5"
                    >
                      <dt className="text-body-sm text-muted-foreground font-bold">{d.label}</dt>
                      <dd className="text-body-sm break-words">{d.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
            {related.length > 0 && (
              <section aria-labelledby="related-products" className="flex flex-col gap-4">
                <h2 id="related-products" className="text-h3">
                  You may also like
                </h2>
                <ProductRail products={related} />
              </section>
            )}
          </div>
        </DetailTemplate>
      </CustomerPricesProvider>
    </SelectedSkuProvider>
  );
}

/** 3 → "3 hours", 24 → "1 day", 48 → "2 days", 30 → "30 hours". */
function formatProcessingTime(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
