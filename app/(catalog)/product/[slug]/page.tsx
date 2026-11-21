import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui";
import { AddToCartButton } from "@/features/cart";
import { getCategory, getFeaturedProducts, getProduct } from "@/lib/erp";
import { formatPrice } from "@/lib/utils";

// Product: static + ISR, "catalog" cache profile (refreshes every 15 min) — see README.

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
    <main className="max-w-content mx-auto flex w-full flex-1 flex-col gap-6 px-4 py-10 md:px-6 md:py-16">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          ...(category ? [{ label: category.name, href: `/category/${category.slug}` }] : []),
          { label: product.name },
        ]}
      />
      <h1 className="text-h1">{product.name}</h1>
      <p className="font-display text-h2 text-primary font-bold">
        {formatPrice(product.price, product.currency)}
      </p>
      <p className="text-muted-foreground">{product.description}</p>
      <div>
        <AddToCartButton
          item={{ sku: product.slug, name: product.name, unitPrice: product.price }}
        />
      </div>
    </main>
  );
}
