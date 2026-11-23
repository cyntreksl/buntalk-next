import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

// Better Auth for real, on an in-memory Postgres (PGlite) with our migrations.
let db: Db;
vi.mock("@/lib/db", () => ({ getDb: async () => db }));
const mergeCartOnSignIn = vi.fn();
vi.mock("@/lib/cart/signin.server", () => ({
  mergeCartOnSignIn: (...a: unknown[]) => mergeCartOnSignIn(...a),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: () => {}, get: () => undefined }) }));

const { getAuth } = await import("./server");

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: join(process.cwd(), "drizzle") });
  db = pg as unknown as Db;
});

const ORIGIN = "http://localhost:3000";
const PASSWORD = "local-test-Pass-8421";

/** The session cookie a response set, as a request Cookie header. */
const cookieFrom = (res: Response) => {
  const raw = res.headers.getSetCookie().find((c) => c.includes("buntalk.session_token="));
  if (!raw) throw new Error("no session cookie");
  return raw.split(";")[0];
};
const headersWith = (cookie: string) => new Headers({ cookie, origin: ORIGIN });

async function signIn(email: string) {
  const auth = await getAuth();
  const res = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: new Headers({ origin: ORIGIN }),
    asResponse: true,
  });
  expect(res.status).toBe(200);
  return cookieFrom(res);
}

describe("sign-in framework (BUN-186)", () => {
  it("signs up with email and password, with a secure httpOnly session cookie", async () => {
    const auth = await getAuth();
    const res = await auth.api.signUpEmail({
      body: { name: "Nimal Perera", email: "Nimal@Example.test", password: PASSWORD },
      headers: new Headers({ origin: ORIGIN }),
      asResponse: true,
    });
    expect(res.status).toBe(200);
    const raw = res.headers.getSetCookie().find((c) => c.includes("session_token="))!;
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    expect(raw).toMatch(/Max-Age=2592000/); // 30 days

    const session = await auth.api.getSession({ headers: headersWith(cookieFrom(res)) });
    expect(session?.user).toMatchObject({ name: "Nimal Perera", email: "nimal@example.test" });
    // The guest cart joins the new account's cart.
    expect(mergeCartOnSignIn).toHaveBeenCalledWith(session!.user.id);
    // The password is stored only as a hash, on the email-and-password sign-in method.
    const [account] = await db.select().from(schema.authAccounts);
    expect(account).toMatchObject({ providerId: "credential", userId: session!.user.id });
    expect(account.password).not.toContain(PASSWORD);
  });

  it("can't be given a customer link by the customer", async () => {
    const auth = await getAuth();
    await auth.api
      .signUpEmail({
        body: {
          name: "Sneaky",
          email: "sneaky@example.test",
          password: PASSWORD,
          customerId: "00000000-0000-0000-0000-000000000000",
        } as never,
        headers: new Headers({ origin: ORIGIN }),
      })
      .catch(() => null);
    const users = await db.select().from(schema.authUsers);
    expect(users.every((u) => u.customerId === null)).toBe(true);
  });

  it("refuses a wrong password", async () => {
    const auth = await getAuth();
    await expect(
      auth.api.signInEmail({
        body: { email: "nimal@example.test", password: "wrong-password-123" },
        headers: new Headers({ origin: ORIGIN }),
      }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  });

  it("signing out ends the session in the database, so the cookie stops working", async () => {
    const auth = await getAuth();
    const cookie = await signIn("nimal@example.test");
    expect(await auth.api.getSession({ headers: headersWith(cookie) })).not.toBeNull();
    await auth.api.signOut({ headers: headersWith(cookie) });
    expect(await auth.api.getSession({ headers: headersWith(cookie) })).toBeNull();
  });

  it("signing out on all devices ends every session of the account", async () => {
    const auth = await getAuth();
    const phone = await signIn("nimal@example.test");
    const laptop = await signIn("nimal@example.test");
    await auth.api.revokeSessions({ headers: headersWith(laptop) });
    expect(await auth.api.getSession({ headers: headersWith(phone) })).toBeNull();
    expect(await auth.api.getSession({ headers: headersWith(laptop) })).toBeNull();
  });

  it("ignores a made-up or tampered cookie", async () => {
    const auth = await getAuth();
    const cookie = await signIn("nimal@example.test");
    const tampered = cookie.replace(/=(.)/, "=x$1");
    expect(await auth.api.getSession({ headers: headersWith(tampered) })).toBeNull();
    expect(
      await auth.api.getSession({ headers: headersWith("buntalk.session_token=made.up") }),
    ).toBeNull();
  });
});
