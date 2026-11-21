import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailTemplate } from "@/components/layout/templates";
import { AddToCartButton } from "@/features/cart";
import { ProductImage } from "@/features/catalog";
import { getCategory, getFeaturedProducts, getProduct } from "@/lib/erp";
import { formatPrice } from "@/lib/utils";

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
  if (!product) return {};
  return { title: product.name, description: product.description };
}

export default async function ProductPage({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const category = await getCategory(product.categorySlug);

  return (
    <DetailTemplate
      breadcrumb={[
        { label: "Home", href: "/" },
        ...(category ? [{ label: category.name, href: `/category/${category.slug}` }] : []),
        { label: product.name },
      ]}
      media={<ProductImage product={product} />}
      summary={
        <>
          <h1 className="text-h1 break-words">{product.name}</h1>
          <p className="font-display text-h2 text-primary font-bold">
            {formatPrice(product.price, product.currency)}
          </p>
          <p className="text-muted-foreground">{product.description}</p>
          <AddToCartButton
            item={{ sku: product.slug, name: product.name, unitPrice: product.price }}
          />
        </>
      }
    >
      <section aria-labelledby="product-details" className="flex max-w-prose flex-col gap-3">
        <h2 id="product-details" className="text-h3">
          Product details
        </h2>
        <p>{product.description}</p>
      </section>
    </DetailTemplate>
  );
}
