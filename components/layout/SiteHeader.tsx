import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const navLinks = [
  { href: "/search", label: "Search" },
  { href: "/cart", label: "Cart" },
  { href: "/account", label: "Account" },
];

export function SiteHeader() {
  return (
    <header className="border-border bg-surface border-b">
      <div className="max-w-page mx-auto flex w-full items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" aria-label="Buntalk home" className="shrink-0">
          <Logo variant="compact" height={40} priority />
        </Link>
        <nav aria-label="Main">
          <ul className="text-body-sm flex items-center gap-4 font-semibold md:gap-6">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-foreground hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
