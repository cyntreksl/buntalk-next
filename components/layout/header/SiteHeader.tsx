import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { buildCategoryTree } from "@/lib/categories";
import { getNavigationCategories } from "@/lib/erp";
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
 *                         ☰ opens a drawer with search, categories, account, language
 *   Desktop (lg+):        [logo] [search ..........] [EN] [account] [cart]
 *                         [All categories ▾] [category] [category] …   ← mega-menu row
 *
 * Categories come from the ERP (cached, see lib/erp/catalog.ts), so the header
 * HTML is the same for every visitor and can be cached with the page. Anything
 * per-visitor — cart count, signed-in state — is filled in by small client
 * components after the page loads.
 *
 * Heights match --header-height in styles/globals.css (64px; 112px from lg).
 */
export async function SiteHeader() {
  // Category tree in the ERP's order (top level, with sub-categories).
  const categories = buildCategoryTree(await getNavigationCategories());
  const languageSwitcher = <LanguageSwitcher />;

  return (
    <StickyHeader>
      <div className="max-w-page mx-auto flex h-16 w-full items-center gap-2 px-4 md:px-6 lg:gap-6">
        <div className="lg:hidden">
          <MobileNav
            categories={categories}
            search={<HeaderSearch id="mobile-search" />}
            languageSwitcher={languageSwitcher}
          />
        </div>
        <Link href="/" aria-label="Buntalk home" className="shrink-0">
          <Logo variant="compact" height={40} priority />
        </Link>
        <HeaderSearch id="header-search" className="hidden max-w-xl flex-1 lg:flex" />
        <div className="ml-auto flex items-center gap-1">
          <div className="hidden lg:block">{languageSwitcher}</div>
          <AccountMenu />
          <CartButton />
        </div>
      </div>
      <nav aria-label="Categories" className="border-border relative hidden border-t lg:block">
        <div className="max-w-page mx-auto w-full px-3 md:px-3">
          <MegaMenu categories={categories} />
        </div>
      </nav>
    </StickyHeader>
  );
}
