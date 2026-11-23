import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import type { Email } from "@/lib/email";

// Better Auth for real, on an in-memory Postgres (PGlite) with our migrations.
let db: Db;
vi.mock("@/lib/db", () => ({ getDb: async () => db }));
const mergeCartOnSignIn = vi.fn();
vi.mock("@/lib/cart/signin.server", () => ({
  mergeCartOnSignIn: (...a: unknown[]) => mergeCartOnSignIn(...a),
}));
const sent: Email[] = [];
vi.mock("@/lib/email", () => ({ sendEmail: async (e: Email) => void sent.push(e) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: () => {}, get: () => undefined }) }));

const { getAuth } = await import("./server");

beforeAll(async () => {
  const pg = drizzle(new PGlite(), { schema });
  await migrate(pg, { migrationsFolder: join(process.cwd(), "drizzle") });
  db = pg as unknown as Db;
});
beforeEach(() => {
  sent.length = 0;
  mergeCartOnSignIn.mockReset();
});

const ORIGIN = "http://localhost:3000";
const PASSWORD = "Rose-garden-42";
const json = { origin: ORIGIN, "content-type": "application/json" };

/** The session cookie a response set, as a request Cookie header. */
const cookieFrom = (res: Response) => {
  const raw = res.headers.getSetCookie().find((c) => c.includes("buntalk.session_token="));
  if (!raw) throw new Error("no session cookie");
  return raw.split(";")[0];
};
const headersWith = (cookie: string) => new Headers({ cookie, origin: ORIGIN });

/** Through the HTTP handler, as the browser does (rate limits apply), from one client IP. */
async function post(path: string, body: unknown, ip = "203.0.113.7") {
  const auth = await getAuth();
  return auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: "POST",
      headers: { ...json, "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  );
}

async function signUp(email: string, extra: Record<string, unknown> = {}, ip?: string) {
  return post(
    "/sign-up/email",
    { name: "Nimal Perera", email, password: PASSWORD, callbackURL: "/email-verified", ...extra },
    ip,
  );
}

/** Follows the confirmation link in the last email; returns the session cookie it set. */
async function confirmFromEmail() {
  const auth = await getAuth();
  const link = sent.at(-1)!.text.match(/https?:\/\/\S+verify-email\S+/)![0];
  const res = await auth.handler(new Request(link, { headers: { origin: ORIGIN } }));
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toContain("/email-verified");
  return cookieFrom(res);
}

describe("email and password sign-up (BUN-187)", () => {
  it("needs the email confirmed; the link signs the customer in", async () => {
    const res = await signUp("Nimal@Example.test", { username: "Nimal.P" });
    expect(res.status).toBe(200);
    // No session until the email is confirmed.
    expect(res.headers.getSetCookie().some((c) => c.includes("session_token="))).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: "nimal@example.test",
      subject: "Confirm your email for Buntalk",
    });

    const cookie = await confirmFromEmail();
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: headersWith(cookie) });
    expect(session?.user).toMatchObject({
      email: "nimal@example.test",
      emailVerified: true,
      username: "nimal.p",
    });
    expect(mergeCartOnSignIn).toHaveBeenCalledWith(session!.user.id);
  });

  it("stores the password only as a hash", async () => {
    const [account] = await db.select().from(schema.authAccounts);
    expect(account.providerId).toBe("credential");
    expect(account.password).not.toContain(PASSWORD);
    expect(account.password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/); // scrypt salt:hash
  });

  it("refuses a weak password, on the server too", async () => {
    for (const password of ["password123", "abcdefgh", "weak2024x", "short1"]) {
      const res = await signUp("weak@example.test", { password }, "198.51.100.30");
      expect(res.status).toBe(400);
    }
    const res = await signUp("weak@example.test", { password: "password123" }, "198.51.100.31");
    expect(await res.json()).toMatchObject({ code: "PASSWORD_TOO_WEAK" });
    expect(sent).toHaveLength(0);
  });

  it("doesn't show whether an email already has an account; the owner gets an email", async () => {
    const res = await signUp("nimal@example.test", {}, "198.51.100.20");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ token: null, user: { email: "nimal@example.test" } });
    expect(sent.at(-1)).toMatchObject({ subject: "You already have a Buntalk account" });
    expect(await db.select().from(schema.authUsers)).toHaveLength(1);
  });

  it("can't be given a customer link by the customer", async () => {
    await signUp(
      "sneaky@example.test",
      { customerId: "00000000-0000-0000-0000-000000000000" },
      "198.51.100.21",
    );
    const users = await db.select().from(schema.authUsers);
    expect(users.every((u) => u.customerId === null)).toBe(true);
  });
});

describe("email or username sign-in (BUN-187)", () => {
  it("signs in with the email or the username (any case)", async () => {
    const byEmail = await post(
      "/sign-in/email",
      { email: "nimal@example.test", password: PASSWORD },
      "192.0.2.1",
    );
    expect(byEmail.status).toBe(200);
    expect(cookieFrom(byEmail)).toMatch(/^buntalk\.session_token=/);
    const byUsername = await post(
      "/sign-in/username",
      { username: "NIMAL.P", password: PASSWORD },
      "192.0.2.2",
    );
    expect(byUsername.status).toBe(200);
  });

  it("gives the same answer for a wrong password and an unknown account", async () => {
    const wrong = await post(
      "/sign-in/email",
      { email: "nimal@example.test", password: "Wrong-pass-99" },
      "192.0.2.3",
    );
    const unknown = await post(
      "/sign-in/email",
      { email: "nobody@example.test", password: "Wrong-pass-99" },
      "192.0.2.3",
    );
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect((await wrong.json()).code).toBe((await unknown.json()).code);

    const wrongUser = await post(
      "/sign-in/username",
      { username: "nimal.p", password: "Wrong-pass-99" },
      "192.0.2.4",
    );
    const unknownUser = await post(
      "/sign-in/username",
      { username: "nobody", password: "Wrong-pass-99" },
      "192.0.2.4",
    );
    expect(wrongUser.status).toBe(401);
    expect((await wrongUser.json()).code).toBe((await unknownUser.json()).code);
  });

  it("an unconfirmed account can't sign in, and gets a new confirmation link", async () => {
    await signUp("later@example.test", {}, "192.0.2.5");
    sent.length = 0;
    const res = await post(
      "/sign-in/email",
      { email: "later@example.test", password: PASSWORD },
      "192.0.2.5",
    );
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("EMAIL_NOT_VERIFIED");
    expect(sent.at(-1)).toMatchObject({
      to: "later@example.test",
      subject: "Confirm your email for Buntalk",
    });
  });

  it("slows down repeated tries: 5 sign-ins per 5 minutes from one address", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await post(
        "/sign-in/email",
        { email: "nimal@example.test", password: "Wrong-pass-99" },
        "192.0.2.99",
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses.slice(5)).toEqual([429, 429]);
    // Another address isn't affected.
    const other = await post(
      "/sign-in/email",
      { email: "nimal@example.test", password: PASSWORD },
      "192.0.2.100",
    );
    expect(other.status).toBe(200);
  });
});

describe("sessions (BUN-186)", () => {
  async function signIn(ip: string) {
    const res = await post(
      "/sign-in/email",
      { email: "nimal@example.test", password: PASSWORD },
      ip,
    );
    expect(res.status).toBe(200);
    return cookieFrom(res);
  }

  it("the session cookie is httpOnly, SameSite=Lax and lasts 30 days", async () => {
    const res = await post(
      "/sign-in/email",
      { email: "nimal@example.test", password: PASSWORD },
      "192.0.2.10",
    );
    const raw = res.headers.getSetCookie().find((c) => c.includes("session_token="))!;
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    expect(raw).toMatch(/Max-Age=2592000/);
  });

  it("signing out ends the session in the database, so the cookie stops working", async () => {
    const auth = await getAuth();
    const cookie = await signIn("192.0.2.11");
    expect(await auth.api.getSession({ headers: headersWith(cookie) })).not.toBeNull();
    await auth.api.signOut({ headers: headersWith(cookie) });
    expect(await auth.api.getSession({ headers: headersWith(cookie) })).toBeNull();
  });

  it("signing out on all devices ends every session of the account", async () => {
    const auth = await getAuth();
    const phone = await signIn("192.0.2.12");
    const laptop = await signIn("192.0.2.13");
    await auth.api.revokeSessions({ headers: headersWith(laptop) });
    expect(await auth.api.getSession({ headers: headersWith(phone) })).toBeNull();
    expect(await auth.api.getSession({ headers: headersWith(laptop) })).toBeNull();
  });

  it("ignores a made-up or tampered cookie", async () => {
    const auth = await getAuth();
    const cookie = await signIn("192.0.2.14");
    const tampered = cookie.replace(/=(.)/, "=x$1");
    expect(await auth.api.getSession({ headers: headersWith(tampered) })).toBeNull();
    expect(
      await auth.api.getSession({ headers: headersWith("buntalk.session_token=made.up") }),
    ).toBeNull();
  });
});
