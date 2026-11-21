import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/lib/erp";
import { SectionHeading } from "./SectionHeading";

/** Category tiles. Uses the ERP category image when there is one, otherwise a branded letter tile. */
export function FeaturedCategories({ categories }: { categories: Category[] }) {
  if (categories.length === 0) return null;
  return (
    <div>
      <SectionHeading id="categories" title="Shop by category" />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {categories.slice(0, 12).map((category) => (
          <li key={category.slug}>
            <Link
              href={`/category/${category.slug}`}
              prefetch={true}
              className="group border-border bg-surface hover:border-accent flex h-full flex-col overflow-hidden rounded-lg border transition-colors"
            >
              <span className="bg-accent-soft text-accent-soft-foreground font-display text-h1 relative flex aspect-[4/3] items-center justify-center font-bold">
                {category.imageUrl ? (
                  // TODO(BUN-159): add the ERP image host to images.remotePatterns and drop `unoptimized`.
                  <Image
                    src={category.imageUrl}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 190px, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <span aria-hidden="true">{category.name.charAt(0)}</span>
                )}
              </span>
              <span className="group-hover:text-primary p-3 font-bold">{category.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
