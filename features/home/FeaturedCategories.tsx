import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/lib/erp";
import { ScrollRow } from "./ScrollRow";
import { SectionHeading } from "./SectionHeading";

/**
 * "Explore our categories": round category tiles in a scrolling row, in the
 * ERP's order. Uses the ERP category image when there is one, otherwise a
 * branded letter.
 */
export function FeaturedCategories({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;
  return (
    <div>
      <SectionHeading id="categories" title="Explore our categories" />
      <ScrollRow label="Categories">
        {categories.slice(0, 16).map((category) => (
          <li key={category.slug} className="shrink-0 snap-start">
            <Link
              href={`/category/${category.slug}`}
              prefetch={true}
              className="group flex w-22 flex-col items-center gap-2 text-center lg:w-26"
            >
              <span className="bg-surface-muted text-accent-soft-foreground font-display group-hover:ring-accent text-h2 relative flex size-22 items-center justify-center overflow-hidden rounded-full font-bold ring-2 ring-transparent transition-shadow lg:size-26">
                {category.imageUrl ? (
                  // TODO(BUN-159): add the ERP image host to images.remotePatterns and drop `unoptimized`.
                  <Image
                    src={category.imageUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="104px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span aria-hidden="true">{category.name.charAt(0)}</span>
                )}
              </span>
              <span className="text-body-sm text-foreground group-hover:text-primary line-clamp-2 font-semibold">
                {category.name}
              </span>
            </Link>
          </li>
        ))}
      </ScrollRow>
    </div>
  );
}
