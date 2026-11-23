import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui";
import { CakeStudioMenuView } from "@/features/cake-studio/CakeStudioMenuView";
import { SavedDesign } from "@/features/cake-studio/SavedDesign";
import { getCakeStudioMenu, type CakeStudioMenu } from "@/lib/erp";

export const metadata: Metadata = {
  title: "Cake Studio",
  description: "Design your own cake: choose the size, flavours and decorations.",
};

/**
 * Cake Studio (BUN-179). Everything on this page comes from the ERP's Cake
 * Studio: the menu (cached, refreshed by the ERP's `cake_studio` webhook) and,
 * with `?design={id}`, a saved design priced again today. The 3D designer is
 * BUN-180 to BUN-182; adding a design to the cart is BUN-184.
 */
export default async function CakeStudioPage({ searchParams }: PageProps<"/cake-studio">) {
  let menu: CakeStudioMenu | null = null;
  try {
    menu = await getCakeStudioMenu();
  } catch (error) {
    console.error("[cake-studio] Could not load the menu from the ERP.", error);
  }

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

      {!menu ? (
        <Card padding="lg">
          <p className="font-bold">Cake Studio can&apos;t be shown right now.</p>
          <p className="text-muted-foreground">Please try again in a few minutes.</p>
        </Card>
      ) : (
        <>
          <Card padding="lg" className="bg-accent-soft flex flex-col gap-1 border-0">
            {menu.rules.isOpen ? (
              <>
                <p className="font-bold">The 3D cake designer is coming soon.</p>
                <p className="text-body-sm">
                  Here is everything you&apos;ll be able to choose from, with today&apos;s prices.
                </p>
              </>
            ) : (
              <>
                <p className="font-bold">Cake Studio is closed for new orders right now.</p>
                <p className="text-body-sm">You can still look through the menu.</p>
              </>
            )}
          </Card>
          <CakeStudioMenuView menu={menu} />
        </>
      )}
    </Container>
  );
}
