import { getSession } from "@/lib/auth";

/**
 * GET /api/session: is the visitor signed in, and their first name (BUN-186).
 *
 * The site header is part of cached pages, so it can't read the session on
 * the server. The account menu calls this from the browser instead. Never
 * cached (Cache-Control: no-store); returns nothing else about the customer.
 */
export async function GET() {
  const session = await getSession();
  return Response.json(
    session
      ? { signedIn: true, firstName: session.name.trim().split(/\s+/)[0] || null }
      : { signedIn: false, firstName: null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
