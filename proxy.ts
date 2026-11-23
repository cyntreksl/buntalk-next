import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_PREFIX, signInHref } from "@/lib/auth/constants";

/**
 * Pages only for signed-in customers (BUN-186): a visitor without a session
 * cookie goes to sign-in, and back to the page afterwards.
 *
 * This is only a quick first check (it doesn't open the database): the pages
 * check the session itself on the server (requireSession / AccountGate), so
 * an expired or signed-out cookie is caught there too.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX })) return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(signInHref(pathname + search), request.url));
}

export const config = {
  // Keep in step with PROTECTED_PATHS in lib/auth/constants.ts.
  matcher: ["/account", "/account/:path*"],
};
