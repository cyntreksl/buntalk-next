import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui";
import { CakeStudioMain } from "@/features/cake-studio/CakeStudioMain";
import { sizeForProduct } from "@/lib/cake-studio/embed.server";
import { getCakeStudioMenu, getProduct, type CakeStudioMenu } from "@/lib/erp";
import { defaultSkuId } from "@/lib/pricing";

// The page reads `params` (the product) before rendering, like the product page,
// so skip Next's dev-time "instant navigation" check for it.
export const instant = false;

export async function generateMetadata({
  params,
}: PageProps<"/cake-studio/[productSlug]">): Promise<Metadata> {
  const { productSlug } = await params;
  const product = await getProduct(productSlug);
  return product?.customizable
    ? { title: `Customize ${product.name}`, robots: { index: false } }
    : { title: "Page not found" };
}

async function loadMenu(): Promise<CakeStudioMenu | null> {
  try {
    return await getCakeStudioMenu();
  } catch (error) {
    console.error("[cake-studio] Could not load the menu from the ERP.", error);
    return null;
  }
}

/**
 * Cake Studio opened from a cake product (BUN-180): the same embedded Cake
 * Studio, with that cake's size already chosen (the ERP size linked to the
 * product's SKU; the product and SKU are also sent in the signed session so
 * the ERP can choose it itself). Only Cake Studio products (ERP
 * is_customisable); anything else is a 404.
 */
export default async function CustomizeProductPage({
  params,
}: PageProps<"/cake-studio/[productSlug]">) {
  const { productSlug } = await params;
  const product = await getProduct(productSlug);
  if (!product?.customizable) notFound();

  const menu = await loadMenu();
  const skuId = defaultSkuId(product.skus);
  const sizeId = sizeForProduct(menu, product, skuId);

  return (
    <Container className="flex flex-col gap-8 py-8 md:py-12">
      <PageHeader
        title={`Customize: ${product.name}`}
        description={
          menu?.rules.welcome ??
          "Choose the size, flavours and decorations, then add it to your cart."
        }
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: product.name, href: `/product/${product.slug}` },
          { label: "Cake Studio" },
        ]}
      />
      <Suspense fallback={<Skeleton className="h-[40rem] w-full rounded-2xl" />}>
        <CakeStudioMain
          menu={menu}
          preselect={{ productId: product.id, skuId, sizeId }}
          title={`Cake Studio: ${product.name}`}
        />
      </Suspense>
    </Container>
  );
}
