import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { buildCategoryTree } from "@/lib/categories";
import { getNavigationCategories } from "@/lib/erp";
import { MapPinIcon } from "@/components/ui";
import { AccountMenu } from "./AccountMenu";
import { CartButton } from "./CartButton";
import { HeaderSearch } from "./HeaderSearch";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { MegaMenu } from "./MegaMenu";
import { MobileNav } from "./MobileNav";
import { StickyHeader } from "./StickyHeader";

/**
 * Storefront header, shown on every (site) page.
 *
 *   Phone/tablet (< lg):  [☰] [logo] ............ [account] [cart]
 *                         [( search pill ................... (🔍) )]
 *                         ☰ opens a drawer with categories, account, language
 *   Desktop (lg+):        [logo] [( search pill ......... (🔍) )] [EN] [Sign in] [Cart]
 *                         [(☰ All categories ▾)] category  category …   Cake Studio · Outlets
 *
 * Categories come from the ERP (cached, see lib/erp/catalog.ts), so the header
 * HTML is the same for every visitor and can be cached with the page. Anything
 * per-visitor — cart count, signed-in state — is filled in by small client
 * components after the page loads.
 *
 * Heights match --header-height in styles/globals.css (120px; 112px from lg).
 */
export async function SiteHeader() {
  // Category tree in the ERP's order (top level, with sub-categories).
  const categories = buildCategoryTree(await getNavigationCategories());
  const languageSwitcher = <LanguageSwitcher />;

  return (
    <StickyHeader>
      <div className="max-w-page mx-auto flex h-16 w-full items-center gap-2 px-4 md:px-6 lg:gap-6">
        <div className="lg:hidden">
          <MobileNav categories={categories} languageSwitcher={languageSwitcher} />
        </div>
        <Link href="/" aria-label="Buntalk home" className="shrink-0">
          <Logo variant="compact" height={40} priority />
        </Link>
        <HeaderSearch id="header-search" className="hidden max-w-2xl flex-1 lg:flex" />
        <div className="ml-auto flex items-center gap-0.5">
          <div className="hidden lg:block">{languageSwitcher}</div>
          <AccountMenu />
          <CartButton />
        </div>
      </div>
      {/* Phones/tablets: search always visible under the top row (marketplace style). */}
      <div className="px-4 pb-3 md:px-6 lg:hidden">
        <HeaderSearch id="mobile-search" className="h-11" />
      </div>
      <nav aria-label="Categories" className="border-border relative hidden border-t lg:block">
        <div className="max-w-page mx-auto flex w-full items-center justify-between gap-4 px-4 md:px-6">
          <MegaMenu categories={categories} />
          {/* Quick links on the right of the category row. */}
          <ul className="text-body-sm flex shrink-0 items-center gap-1 font-bold">
            <li>
              <Link
                href="/cake-studio"
                className="text-primary hover:bg-accent-soft inline-flex h-9 items-center rounded-full px-3"
              >
                Cake Studio
              </Link>
            </li>
            <li>
              <Link
                href="/outlets"
                className="text-foreground hover:bg-surface-muted inline-flex h-9 items-center gap-1.5 rounded-full px-3"
              >
                <MapPinIcon size={16} />
                Our outlets
              </Link>
            </li>
          </ul>
        </div>
      </nav>
    </StickyHeader>
  );
}
