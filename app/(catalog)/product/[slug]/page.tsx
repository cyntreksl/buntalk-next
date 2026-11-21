import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/features/cart";
import { getFeaturedProducts, getProduct } from "@/lib/erp";
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <Link
        href={`/category/${product.categorySlug}`}
        prefetch={true}
        className="text-sm underline"
      >
        &larr; Back to category
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
      <p className="text-xl">{formatPrice(product.price, product.currency)}</p>
      <p className="text-foreground/70">{product.description}</p>
      <div>
        <AddToCartButton
          item={{ sku: product.slug, name: product.name, unitPrice: product.price }}
        />
      </div>
    </main>
  );
}
