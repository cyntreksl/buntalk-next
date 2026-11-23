import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import { isProtectedPath, safeNext, signInHref } from "./constants";

describe("after sign-in (BUN-186)", () => {
  it("only goes back to a page on this site", () => {
    expect(safeNext("/account/orders?page=2")).toBe("/account/orders?page=2");
    expect(safeNext("/checkout")).toBe("/checkout");
    for (const bad of [
      "https://evil.test",
      "//evil.test",
      String.raw`/\evil.test`,
      "javascript:alert(1)",
    ]) {
      expect(safeNext(bad)).toBe("/account");
    }
    // Never back to sign-in itself, or to an API.
    expect(safeNext("/sign-in?next=/x")).toBe("/account");
    expect(safeNext("/api/auth/sign-out")).toBe("/account");
    expect(safeNext(undefined, "/")).toBe("/");
  });

  it("protects the account pages only", () => {
    expect(isProtectedPath("/account")).toBe(true);
    expect(isProtectedPath("/account/orders")).toBe(true);
    expect(isProtectedPath("/accounting")).toBe(false);
    expect(isProtectedPath("/checkout")).toBe(false); // guests can check out (BUN-197)
    expect(signInHref("/account/orders")).toBe("/sign-in?next=%2Faccount%2Forders");
  });
});

describe("proxy", () => {
  const request = (path: string, cookie?: string) =>
    new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });

  it("sends a visitor without a session cookie to sign-in, and back afterwards", () => {
    const res = proxy(request("/account/orders?page=2"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/sign-in?next=%2Faccount%2Forders%3Fpage%3D2",
    );
  });

  it("lets a visitor with a session cookie through (the page checks it)", () => {
    const res = proxy(request("/account", "buntalk.session_token=abc.def"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});
