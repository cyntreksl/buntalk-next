/** Shared sign-in settings, safe for the proxy, the server and the browser. */

/** Session cookies are named `buntalk.session_token` (`__Secure-` in front on https). */
export const AUTH_COOKIE_PREFIX = "buntalk";

/** A session lasts this long, extended while the customer keeps using the site. */
export const SESSION_DAYS = 30;

/** Pages only for signed-in customers. Others send them to sign-in and back (proxy.ts). */
export const PROTECTED_PATHS = ["/account"];

export const isProtectedPath = (path: string) =>
  PROTECTED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Where to go after signing in: a path on this site only (never another site,
 * `//evil.example`, or back to the sign-in pages), else the account page.
 */
export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  if (/^\/(sign-in|sign-up)(\/|\?|$)/.test(next) || next.startsWith("/api/")) return fallback;
  return next.slice(0, 500);
}

/** The sign-in page, coming back to `next` afterwards. */
export const signInHref = (next?: string) =>
  next ? `/sign-in?${new URLSearchParams({ next })}` : "/sign-in";
