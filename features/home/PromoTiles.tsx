import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/lib/erp";
import { cx } from "@/lib/utils";

const tones = [
  "bg-primary text-primary-foreground",
  "bg-accent-soft text-accent-soft-foreground",
  "bg-secondary text-secondary-foreground",
];

/**
 * Three tall promo tiles for the first top-level categories (ERP order), each
 * linking to its category page. Uses the category image when there is one.
 */
export function PromoTiles({ categories }: { categories: Category[] }) {
  const tiles = categories.slice(0, 3);
  if (tiles.length === 0) return null;
  return (
    <ul aria-label="Shop by collection" className="grid gap-4 sm:grid-cols-3">
      {tiles.map((category, i) => (
        <li key={category.slug}>
          <Link
            href={`/category/${category.slug}`}
            prefetch={true}
            className={cx(
              "group relative isolate flex min-h-52 flex-col justify-end gap-2 overflow-hidden rounded-2xl p-6 sm:min-h-72",
              tones[i % tones.length],
            )}
          >
            {category.imageUrl ? (
              <>
                {/* TODO(BUN-159): add the ERP image host to images.remotePatterns and drop `unoptimized`. */}
                <Image
                  src={category.imageUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="(min-width: 640px) 33vw, 100vw"
                  className="-z-10 object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span
                  aria-hidden="true"
                  className="from-secondary/80 absolute inset-0 -z-10 bg-linear-to-t to-transparent"
                />
              </>
            ) : (
              <span
                aria-hidden="true"
                className="font-display absolute -top-6 -right-2 -z-10 text-[10rem] leading-none font-bold opacity-15 transition-transform duration-500 group-hover:-rotate-6"
              >
                {category.name.charAt(0)}
              </span>
            )}
            <span className="text-caption font-bold tracking-wider uppercase opacity-80">
              Fresh from Buntalk
            </span>
            <span className="text-h2 font-extrabold">{category.name}</span>
            <span className="bg-surface text-foreground text-body-sm mt-2 inline-flex h-9 items-center self-start rounded-full px-4 font-bold">
              Shop now
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
