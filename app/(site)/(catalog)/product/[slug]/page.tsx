import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailTemplate } from "@/components/layout/templates";
import { ProductPurchase } from "@/features/cart";
import { ProductImage } from "@/features/catalog";
import { categoryTrail } from "@/lib/categories";
import { getCategories, getFeaturedProducts, getProduct } from "@/lib/erp";

// Product: detail template. Static + ISR, "catalog" cache profile (refreshes every 15 min) — see README.

// The page reads `params` before rendering so its HTML is always complete
// (no loading placeholder, see the (catalog) layout). That intentionally blocks
// on the URL, so skip Next's dev-time "instant navigation" check for it.
// Links to products use prefetch={true}, so navigations are still fast.
export const instant = false;

/**
 * Prerender only the featured products at build time, to keep builds fast.
 * Every other product is built on its first visit and then served from the cache.
 */
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
  const readyIn = product.processingTimeHours
    ? formatProcessingTime(product.processingTimeHours)
    : null;

  const details = [
    product.code && { label: "Item code", value: product.code },
    category && { label: "Category", value: category.name },
    ...(product.attributes ?? []).map((a) => ({ label: a.name, value: a.values.join(", ") })),
    readyIn && { label: "Preparation time", value: readyIn },
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <DetailTemplate
      breadcrumb={[
        { label: "Home", href: "/" },
        ...trail.map((c) => ({ label: c.name, href: `/category/${c.slug}` })),
        { label: product.name },
      ]}
      media={<ProductImage product={product} priority />}
      summary={
        <>
          <h1 className="text-h1 break-words">{product.name}</h1>
          {product.description && <p className="text-muted-foreground">{product.description}</p>}
          {readyIn && <p className="text-body-sm font-semibold">Ready in {readyIn}</p>}
          {/* Price (per size), size picker and add to cart. Prices are the ERP's online prices. */}
          <ProductPurchase product={product} />
        </>
      }
    >
      <section aria-labelledby="product-details" className="flex max-w-prose flex-col gap-4">
        <h2 id="product-details" className="text-h3">
          Product details
        </h2>
        {product.description && <p>{product.description}</p>}
        {details.length > 0 && (
          <dl className="border-border divide-border divide-y border-y">
            {details.map((d) => (
              <div key={d.label} className="grid grid-cols-[10rem_minmax(0,1fr)] gap-4 py-2.5">
                <dt className="text-body-sm text-muted-foreground font-bold">{d.label}</dt>
                <dd className="text-body-sm break-words">{d.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </DetailTemplate>
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
