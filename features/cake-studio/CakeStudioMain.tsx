import { connection } from "next/server";
import { Card } from "@/components/ui";
import { getCustomerId } from "@/lib/auth";
import { startingDesign } from "@/lib/cake-studio/design";
import { cakeStudioEmbedSrc, type Preselect } from "@/lib/cake-studio/embed.server";
import { serverEnv } from "@/lib/env.server";
import { cakeDesignSchema, getCakeDesign, type CakeDesign, type CakeStudioMenu } from "@/lib/erp";
import { CakeDesigner } from "./CakeDesigner";
import { CakeStudioEmbed } from "./CakeStudioEmbed";
import { CakeStudioMenuView } from "./CakeStudioMenuView";

/** Where the designer starts: a saved design, a favourite, or the (pre-selected) size's defaults. */
async function initialDesign(
  menu: CakeStudioMenu,
  options: { designId?: string; favouriteId?: number; sizeId?: number },
): Promise<CakeDesign> {
  if (options.designId) {
    try {
      return (await getCakeDesign(options.designId, { customerId: await getCustomerId() })).design;
    } catch {
      // Unknown or no longer possible: the saved-design panel says why; start fresh here.
    }
  }
  const start = startingDesign(menu, options.sizeId);
  const favourite = menu.favourites.find((f) => f.id === options.favouriteId);
  if (favourite) {
    const merged = cakeDesignSchema.safeParse({ ...start, ...favourite.config });
    if (merged.success) return merged.data;
  }
  return start;
}

/**
 * The main part of a Cake Studio page:
 * - "native" (default, BUN-181): the storefront's designer on the ERP's menu
 *   and pricing, starting from a saved design (`?design=`), a favourite
 *   (`?favourite=`) or the product's cake size;
 * - "embed" (CAKE_STUDIO_MODE=embed, BUN-180): the ERP's Cake Studio in a frame;
 * - `?view=menu`, or no menu: the menu list (or a message).
 *
 * Request-time only (live saved designs, signed embed sessions): render it
 * inside <Suspense>.
 */
export async function CakeStudioMain({
  menu,
  preselect,
  view,
  designId,
  favouriteId,
  title,
}: {
  menu: CakeStudioMenu | null;
  preselect?: Preselect;
  view?: string;
  designId?: string;
  favouriteId?: number;
  title?: string;
}) {
  await connection();
  const mode = serverEnv().CAKE_STUDIO_MODE ?? "native";

  if (view !== "menu" && mode === "embed") {
    const embed = cakeStudioEmbedSrc({ preselect, customerId: await getCustomerId() });
    if (embed) {
      return (
        <CakeStudioEmbed
          src={embed.src}
          origin={embed.origin}
          sizeId={preselect?.sizeId}
          title={title}
        />
      );
    }
  }
  if (!menu) {
    return (
      <Card padding="lg">
        <p className="font-bold">Cake Studio can&apos;t be shown right now.</p>
        <p className="text-muted-foreground">Please try again in a few minutes.</p>
      </Card>
    );
  }
  if (view !== "menu" && menu.rules.isOpen && menu.sizes.length > 0) {
    const initial = await initialDesign(menu, { designId, favouriteId, sizeId: preselect?.sizeId });
    return <CakeDesigner menu={menu} initial={initial} />;
  }
  return (
    <>
      <Card padding="lg" className="bg-accent-soft flex flex-col gap-1 border-0">
        {menu.rules.isOpen ? (
          <>
            <p className="font-bold">Here is everything you can choose from.</p>
            <p className="text-body-sm">Prices are today&apos;s, from our kitchen&apos;s system.</p>
          </>
        ) : (
          <>
            <p className="font-bold">Cake Studio is closed for new orders right now.</p>
            <p className="text-body-sm">You can still look through the menu.</p>
          </>
        )}
      </Card>
      <CakeStudioMenuView menu={menu} highlightSizeId={preselect?.sizeId} />
    </>
  );
}
