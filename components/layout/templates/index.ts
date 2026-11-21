/**
 * Page templates. Each page picks one; see README "Layout and page templates".
 *
 *   FullWidthTemplate  home, landing pages
 *   ListingTemplate    category, search (sidebar + grid)
 *   DetailTemplate     product page (media + summary)
 *   CheckoutTemplate   checkout (form + order summary), under the minimal header
 *   AccountTemplate    account pages (side menu)
 */
export { AccountTemplate, accountNav, type AccountSection } from "./AccountTemplate";
export { CheckoutTemplate } from "./CheckoutTemplate";
export { DetailTemplate } from "./DetailTemplate";
export { FullWidthSection, FullWidthTemplate } from "./FullWidthTemplate";
export { ListingTemplate } from "./ListingTemplate";
