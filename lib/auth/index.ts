import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { signInHref } from "./constants";
import { getAuth } from "./server";

/**
 * Sign-in and sessions (BUN-186). Pages, routes and features use only these
 * functions, never Better Auth directly (lib/auth/server.ts).
 *
 * Every check happens on the server against the database: the session
 * cookie is only a random token. Reading it reads the request, so call these
 * from a component inside <Suspense> (or a route handler / server action);
 * anything that uses the session is never cached for other customers.
 */

export { safeNext, signInHref, isProtectedPath } from "./constants";

export type Session = {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  /** The storefront customer (BUN-166), once registration has created one. */
  customerId: string | null;
  expiresAt: Date;
};

/** The signed-in customer, or null. Checked against the database; once per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const auth = await getAuth();
  const result = await auth.api.getSession({ headers: await headers() });
  if (!result) return null;
  const { user, session } = result;
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    customerId: (user as { customerId?: string | null }).customerId ?? null,
    expiresAt: session.expiresAt,
  };
});

/** The signed-in user's id (the owner of their saved cart), or null for guests. */
export async function getUserId(): Promise<string | null> {
  return (await getSession())?.userId ?? null;
}

/**
 * The signed-in customer's ERP customer id (`PosCustomer` link_id), used to
 * ask the ERP for that customer's own prices. Null for guests, and for a
 * user whose customer isn't linked to the ERP yet (BUN-166 sync).
 */
export const getCustomerId = cache(async (): Promise<string | null> => {
  const session = await getSession();
  if (!session?.customerId) return null;
  const db = await getDb();
  const [row] = await db
    .select({ erpCustomerId: customers.erpCustomerId })
    .from(customers)
    .where(eq(customers.id, session.customerId))
    .limit(1);
  return row?.erpCustomerId ?? null;
});

/**
 * For pages only for signed-in customers: the session, or a redirect to
 * sign-in that comes back to `returnTo` afterwards. The proxy already sends
 * visitors without a session cookie to sign-in; this also catches expired
 * or signed-out sessions whose cookie is still there.
 */
export async function requireSession(returnTo: string): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(signInHref(returnTo));
  return session;
}

const METHOD_LABELS: Record<string, string> = {
  credential: "Email and password",
  google: "Google",
  apple: "Apple",
  "phone-number": "Phone number",
};

/** The signed-in customer's linked sign-in methods ("Email and password", "Google", …). */
export async function listSignInMethods(): Promise<{ id: string; label: string }[]> {
  const auth = await getAuth();
  const accounts = await auth.api.listUserAccounts({ headers: await headers() });
  return accounts.map((a) => ({ id: a.id, label: METHOD_LABELS[a.providerId] ?? a.providerId }));
}
