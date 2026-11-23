import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { mergeCartOnSignIn } from "@/lib/cart/signin.server";
import { getDb, type Db } from "@/lib/db";
import { authAccounts, authSessions, authUsers, authVerifications } from "@/lib/db/schema";
import { authConfig } from "@/lib/env.server";
import { AUTH_COOKIE_PREFIX, SESSION_DAYS } from "./constants";

/**
 * The sign-in framework (BUN-186), on Better Auth. Every sign-in method plugs
 * in here: email and password now (BUN-187 adds verification and password
 * reset), Google (BUN-189), Apple (BUN-190) and phone codes (BUN-191) later.
 *
 * - **Storage:** our Postgres, through Drizzle (`auth_users`, `auth_sessions`,
 *   `auth_accounts`, `auth_verifications` in lib/db/schema.ts).
 * - **Session cookie:** `buntalk.session_token`, httpOnly, SameSite=Lax,
 *   Secure on https, signed with AUTH_SECRET. It holds only a random token;
 *   the session lives in the database and is checked on every request (no
 *   cookie cache), so signing out ends it at once everywhere.
 * - **Expiry and refresh:** 30 days, extended (at most once a day) while the
 *   customer keeps using the site.
 * - **One account, several sign-in methods:** sign-in methods with the same
 *   verified email are linked to one user (`auth_accounts`).
 * - **After sign-in:** the visitor's guest cart joins their saved cart (BUN-178).
 * - Built once per server process, after the database is open.
 */
function createAuth(db: Db) {
  const { secret, baseUrl } = authConfig();
  return betterAuth({
    appName: "Buntalk",
    baseURL: baseUrl,
    basePath: "/api/auth",
    secret,
    trustedOrigins: [baseUrl],
    telemetry: { enabled: false },
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
      },
    }),
    user: {
      additionalFields: {
        // Set by registration (BUN-187/192), never by the customer's own request.
        customerId: { type: "string", required: false, input: false },
      },
    },
    session: {
      expiresIn: SESSION_DAYS * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google", "apple"] },
    },
    // The first sign-in method. BUN-187 adds email verification, password reset and rules.
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      revokeSessionsOnPasswordReset: true,
    },
    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      useSecureCookies: baseUrl.startsWith("https://"),
    },
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        const signedIn = ctx.context.newSession;
        if (signedIn) await mergeCartOnSignIn(signedIn.user.id);
      }),
    },
    // Lets server actions and route handlers set the session cookie. Keep it last.
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const globalForAuth = globalThis as unknown as { buntalkAuth?: Promise<Auth> };

/** The sign-in framework, built on first use (it needs the database). Server only. */
export function getAuth(): Promise<Auth> {
  globalForAuth.buntalkAuth ??= getDb()
    .then(createAuth)
    .catch((error) => {
      globalForAuth.buntalkAuth = undefined;
      throw error;
    });
  return globalForAuth.buntalkAuth;
}
