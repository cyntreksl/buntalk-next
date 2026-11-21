import "server-only";
import { cookies } from "next/headers";

/**
 * Authentication and session handling.
 *
 * Placeholder: the real auth framework, session storage and route protection
 * are set up in BUN-186. Keep all auth logic behind this folder so pages and
 * features never talk to the auth provider directly.
 *
 * Reading cookies() makes the calling component render per request, so
 * anything that uses the session is never cached for other users. Call it
 * from a component inside <Suspense>.
 */
export const SESSION_COOKIE = "buntalk_session";

export type Session = { userId: string } | null;

export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  // TODO(BUN-186): verify the token and load the user.
  return token ? { userId: "unverified" } : null;
}
