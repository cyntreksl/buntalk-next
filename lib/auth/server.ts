import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { mergeCartOnSignIn } from "@/lib/cart/signin.server";
import { getDb, type Db } from "@/lib/db";
import {
  authAccounts,
  authRateLimits,
  authSessions,
  authUsers,
  authVerifications,
} from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { authConfig } from "@/lib/env.server";
import { AUTH_COOKIE_PREFIX, SESSION_DAYS } from "./constants";
import { alreadyRegistered, verifyEmail } from "./emails";
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem } from "./password";
import { USERNAME_PATTERN } from "./username";

/**
 * The sign-in framework (BUN-186), on Better Auth. Every sign-in method plugs
 * in here: email or username and password (BUN-187), password reset
 * (BUN-188), Google (BUN-189), Apple (BUN-190) and phone codes (BUN-191).
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
 * - **Email and password (BUN-187):** sign-up needs the email confirmed
 *   before signing in (the link signs the customer in). Passwords follow the
 *   rules in ./password.ts and are hashed with scrypt. Sign-in takes the email
 *   or the username. Wrong details get one generic message, and signing up
 *   with an email that already has an account looks the same as a new
 *   sign-up (the owner gets an email instead), so nobody can find out who
 *   has an account.
 * - **Rate limits (BUN-187):** sign-in 5 tries and sign-up 5 per 5 minutes,
 *   new confirmation emails 3 per 5 minutes, per client IP and endpoint,
 *   counted in the database (`auth_rate_limits`) across server instances.
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
        rateLimit: authRateLimits,
      },
    }),
    user: {
      additionalFields: {
        // Set when the customer's storefront record is made (it needs a phone number: phone
        // sign-in BUN-191, profile BUN-193, checkout), never by the customer's own request.
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
    emailAndPassword: {
      enabled: true,
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      // Signing up with an email that already has an account: the page shows the
      // usual "check your email", and the owner is told by email.
      onExistingUserSignUp: async ({ user }) => {
        await sendEmail(alreadyRegistered(user.email, user.name, `${baseUrl}/sign-in`));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // An unconfirmed account trying to sign in (with the right password) gets a new link.
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 24 * 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail(verifyEmail(user.email, user.name, url));
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 300, max: 5 },
        "/sign-in/username": { window: 300, max: 5 },
        "/sign-up/email": { window: 300, max: 5 },
        "/send-verification-email": { window: 300, max: 3 },
        "/is-username-available": { window: 60, max: 20 },
      },
    },
    advanced: {
      cookiePrefix: AUTH_COOKIE_PREFIX,
      useSecureCookies: baseUrl.startsWith("https://"),
    },
    hooks: {
      // Password rules (./password.ts) for every new password.
      before: createAuthMiddleware(async (ctx) => {
        const body = (ctx.body ?? {}) as Record<string, unknown>;
        const password =
          ctx.path === "/sign-up/email"
            ? body.password
            : ctx.path === "/reset-password" || ctx.path === "/change-password"
              ? body.newPassword
              : undefined;
        if (typeof password !== "string") return;
        const problem = passwordProblem(password, {
          email: typeof body.email === "string" ? body.email : undefined,
          username: typeof body.username === "string" ? body.username : undefined,
        });
        if (problem) {
          throw APIError.from("BAD_REQUEST", { code: "PASSWORD_TOO_WEAK", message: problem });
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        const signedIn = ctx.context.newSession;
        if (signedIn) await mergeCartOnSignIn(signedIn.user.id);
      }),
    },
    plugins: [
      // Sign in with a username instead of the email (stored in lower case).
      username({
        minUsernameLength: 3,
        maxUsernameLength: 30,
        usernameValidator: (value) => USERNAME_PATTERN.test(value),
        displayUsername: false,
      }),
      // Lets server actions and route handlers set the session cookie. Keep it last.
      nextCookies(),
    ],
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
