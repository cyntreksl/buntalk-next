import "server-only";
import { cookies } from "next/headers";
import { GUEST_CART_DAYS, hashCartToken, newCartToken } from "./persist.server";

/** Random token that identifies a guest's saved cart. httpOnly: scripts can't read it. */
export const CART_COOKIE = "buntalk_cart";

/** The hashed cart token from the request's cookie, or null. */
export async function readCartTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(CART_COOKIE)?.value;
  return token && /^[A-Za-z0-9_-]{40,64}$/.test(token) ? hashCartToken(token) : null;
}

/**
 * The request's cart token hash, creating the cookie when there isn't one
 * (route handlers only). Each save renews it for another GUEST_CART_DAYS days.
 */
export async function ensureCartTokenHash(): Promise<string> {
  const store = await cookies();
  let token = store.get(CART_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) token = newCartToken();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GUEST_CART_DAYS * 24 * 60 * 60,
  });
  return hashCartToken(token);
}
