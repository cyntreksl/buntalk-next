import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui";
import { CakeStudioMain } from "@/features/cake-studio/CakeStudioMain";
import { SavedDesign } from "@/features/cake-studio/SavedDesign";
import { getCakeStudioMenu, type CakeStudioMenu } from "@/lib/erp";

export const metadata: Metadata = {
  title: "Cake Studio",
  description: "Design your own cake: choose the size, flavours and decorations.",
};

async function loadMenu(): Promise<CakeStudioMenu | null> {
  try {
    return await getCakeStudioMenu();
  } catch (error) {
    console.error("[cake-studio] Could not load the menu from the ERP.", error);
    return null;
  }
}

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function Main({ searchParams }: Pick<PageProps<"/cake-studio">, "searchParams">) {
  const { view, design, favourite, line } = await searchParams;
  const editLine = one(line);
  return (
    <CakeStudioMain
      menu={await loadMenu()}
      view={one(view)}
      designId={one(design)}
      favouriteId={Number(one(favourite)) || undefined}
      editLine={design && editLine && editLine.length <= 300 ? editLine : undefined}
    />
  );
}

/**
 * Cake Studio (BUN-179 to BUN-181): the storefront's designer on the ERP's
 * menu and pricing (or, with CAKE_STUDIO_MODE=embed, the ERP's own Cake
 * Studio in a frame). `?design={id}` opens a saved design (shown priced again
 * today, and loaded into the designer); `?favourite={id}` starts from a
 * favourite; `?view=menu` lists the menu. `?design={id}&line={cart line}`
 * edits a cake in the cart ("Update cart" replaces that line, BUN-184).
 * For a cake product, `/cake-studio/{productSlug}` opens with that cake chosen.
 */
export default async function CakeStudioPage({ searchParams }: PageProps<"/cake-studio">) {
  const menu = await loadMenu();
  return (
    <Container className="flex flex-col gap-8 py-8 md:py-12">
      <PageHeader
        title="Cake Studio"
        description={
          menu?.rules.welcome ?? "Design your own cake: choose the size, flavours and decorations."
        }
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Cake Studio" }]}
      />
      {/* A saved design, opened by its code. Reads the URL, so it renders per request. */}
      <Suspense fallback={null}>
        <SavedDesign searchParams={searchParams} />
      </Suspense>
      {/* The embed session is signed per visit, so this part renders per request. */}
      <Suspense fallback={<Skeleton className="h-[40rem] w-full rounded-2xl" />}>
        <Main searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}
