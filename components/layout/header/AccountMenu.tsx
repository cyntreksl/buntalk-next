"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { accountNav } from "@/features/account/nav";
import { ChevronDownIcon, UserIcon, useDismiss } from "@/components/ui";
import { cx } from "@/lib/utils";

type SessionStatus = { signedIn: boolean };

/** Asks the server whether the visitor is signed in (see app/api/session/route.ts). */
export function useSessionStatus() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async (): Promise<SessionStatus> => {
      const res = await fetch("/api/session", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load session");
      return res.json();
    },
    staleTime: 60_000,
  });
}

/**
 * Account / sign-in menu. A button that opens a small dropdown:
 * signed in → account pages; signed out → sign in.
 * Esc, clicking outside or tabbing away closes it.
 */
export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(containerRef, open, close, buttonRef);

  // Close when the page changes (state from the previous render, React's recommended pattern).
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const { data } = useSessionStatus();
  const signedIn = data?.signedIn ?? false;

  const itemClasses =
    "text-body-sm hover:bg-surface-muted block rounded-sm px-3 py-2 font-semibold text-foreground";

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="text-foreground hover:bg-surface-muted inline-flex h-10 items-center gap-1.5 rounded-md px-2"
      >
        <UserIcon size={22} />
        <span className="text-body-sm hidden font-bold xl:inline">
          {signedIn ? "Account" : "Sign in"}
        </span>
        <span className="sr-only xl:hidden">{signedIn ? "Account menu" : "Sign in menu"}</span>
        <ChevronDownIcon
          size={16}
          className={cx("hidden transition-transform xl:block", open && "rotate-180")}
        />
      </button>
      <div
        id={menuId}
        hidden={!open}
        className="border-border bg-surface absolute right-0 z-50 mt-2 w-56 rounded-lg border p-2 shadow-lg"
      >
        {signedIn ? (
          <nav aria-label="Account">
            <ul>
              {accountNav.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className={itemClasses}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <div className="flex flex-col gap-2 p-1">
            <p className="text-body-sm text-muted-foreground px-2">
              Sign in to see your orders and saved addresses.
            </p>
            {/* TODO(BUN-186): link to the sign-in and register pages. */}
            <Link
              href="/account"
              className="bg-primary text-primary-foreground hover:bg-primary-hover text-body-sm block rounded-md px-3 py-2 text-center font-bold"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
