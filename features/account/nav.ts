/** Account section links, shared by the account side menu and the header account menus. */
export const accountNav = [
  { id: "overview", label: "Overview", href: "/account" },
  { id: "orders", label: "Orders", href: "/account/orders" },
  { id: "addresses", label: "Addresses", href: "/account/addresses" },
  { id: "profile", label: "Profile", href: "/account/profile" },
] as const;

export type AccountSection = (typeof accountNav)[number]["id"];
