import Image from "next/image";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui";
import type { Category } from "@/lib/erp";
import { cx } from "@/lib/utils";

/**
 * Category landing header (BUN-168): breadcrumb, then a banner with the
 * category name (the page's <h1>), its description and how many products it
 * has. The banner uses the ERP's wide `bannerUrl`, else the category image,
 * else a branded panel with the category's initial, so it never looks empty.
 */
export function CategoryHeader({
  category,
  breadcrumb,
  productCount,
}: {
  category: Category;
  breadcrumb: BreadcrumbItem[];
  productCount: number;
}) {
  const image = category.bannerUrl ?? category.imageUrl;
  return (
    <header className="flex flex-col gap-4">
      <Breadcrumb items={breadcrumb} />
      <div
        className={cx(
          "relative isolate flex min-h-40 flex-col justify-end overflow-hidden rounded-2xl p-6 md:min-h-52 md:p-8",
          image
            ? "bg-secondary text-secondary-foreground"
            : "bg-accent-soft text-accent-soft-foreground",
        )}
      >
        {image ? (
          <>
            {/* TODO(BUN-238): add the ERP image host to images.remotePatterns and drop `unoptimized`. */}
            <Image
              src={image}
              alt=""
              fill
              priority
              unoptimized
              sizes="(min-width: 1152px) 1152px, 100vw"
              className="-z-10 object-cover"
            />
            <span
              aria-hidden="true"
              className="from-secondary via-secondary/60 absolute inset-0 -z-10 bg-linear-to-t to-transparent"
            />
          </>
        ) : (
          <span
            aria-hidden="true"
            className="font-display absolute -top-8 right-4 -z-10 text-[11rem] leading-none font-bold opacity-15 md:text-[14rem]"
          >
            {category.name.charAt(0)}
          </span>
        )}
        <h1 className="text-h1 text-current">{category.name}</h1>
        {category.description && (
          <p className="text-body-lg mt-1 max-w-prose opacity-90">{category.description}</p>
        )}
        <p className="text-body-sm mt-2 font-semibold opacity-80">
          {productCount} product{productCount === 1 ? "" : "s"}
        </p>
      </div>
    </header>
  );
}
