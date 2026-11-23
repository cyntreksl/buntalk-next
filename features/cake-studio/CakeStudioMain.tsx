import { connection } from "next/server";
import { Card } from "@/components/ui";
import { getCustomerId } from "@/lib/auth";
import { cakeStudioEmbedSrc, type Preselect } from "@/lib/cake-studio/embed.server";
import type { CakeStudioMenu } from "@/lib/erp";
import { CakeStudioEmbed } from "./CakeStudioEmbed";
import { CakeStudioMenuView } from "./CakeStudioMenuView";

/**
 * The main part of a Cake Studio page (BUN-180): the ERP's Cake Studio,
 * embedded, when it's set up (CAKE_STUDIO_EMBED_URL and secret); otherwise,
 * or with `?view=menu`, the menu with today's prices (BUN-179).
 *
 * Request-time only (the embed session is signed now and expires): render it
 * inside <Suspense>.
 */
export async function CakeStudioMain({
  menu,
  preselect,
  view,
  title,
}: {
  menu: CakeStudioMenu | null;
  preselect?: Preselect;
  /** "menu" shows the menu even when the embed is set up. */
  view?: string;
  title?: string;
}) {
  await connection();
  const embed =
    view === "menu" ? null : cakeStudioEmbedSrc({ preselect, customerId: await getCustomerId() });

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
  if (!menu) {
    return (
      <Card padding="lg">
        <p className="font-bold">Cake Studio can&apos;t be shown right now.</p>
        <p className="text-muted-foreground">Please try again in a few minutes.</p>
      </Card>
    );
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
