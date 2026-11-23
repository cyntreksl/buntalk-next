"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useId, useRef, useState } from "react";
import { accountNav } from "@/features/account/nav";
import { useAuthDialog } from "@/features/auth/dialog";
import { SignOutButton } from "@/features/auth/SignOutButton";
import { ChevronDownIcon, UserIcon, useDismiss } from "@/components/ui";
import { cx } from "@/lib/utils";

type SessionStatus = { signedIn: boolean; firstName: string | null };

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
 * signed in → a greeting, the account pages and Sign out; signed out → Sign in
 * and Create an account, in the shared sign-in dialog (BUN-186).
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
  const showAuth = useAuthDialog((state) => state.show);

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
        className="text-foreground hover:bg-surface-muted inline-flex h-10 items-center gap-1.5 rounded-full px-2.5"
      >
        <UserIcon size={22} />
        <span className="text-body-sm hidden font-bold lg:inline">
          {signedIn ? (data?.firstName ?? "Account") : "Sign in"}
        </span>
        <span className="sr-only lg:hidden">{signedIn ? "Account menu" : "Sign in menu"}</span>
        <ChevronDownIcon
          size={16}
          className={cx("hidden transition-transform lg:block", open && "rotate-180")}
        />
      </button>
      <div
        id={menuId}
        hidden={!open}
        className="border-border bg-surface absolute right-0 z-50 mt-2 w-60 rounded-xl border p-2 shadow-lg"
      >
        {signedIn ? (
          <nav aria-label="Account">
            {data?.firstName && (
              <p className="text-body-sm text-muted-foreground px-3 pt-1 pb-2">
                Hello, {data.firstName}
              </p>
            )}
            <ul>
              {accountNav.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className={itemClasses}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-border mt-1 border-t px-1 pt-2">
              <SignOutButton variant="ghost" className="w-full" />
            </div>
          </nav>
        ) : (
          <div className="flex flex-col gap-2 p-1">
            <p className="text-body-sm text-muted-foreground px-2">
              Sign in to see your orders and saved addresses.
            </p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                showAuth("sign-in");
              }}
              className="bg-primary text-primary-foreground hover:bg-primary-hover text-body-sm block rounded-full px-3 py-2 text-center font-bold"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                showAuth("sign-up");
              }}
              className="text-body-sm text-primary py-1 text-center font-semibold underline"
            >
              Create an account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
