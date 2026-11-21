import { getSession } from "@/lib/auth";

/**
 * GET /api/session — is the visitor signed in?
 *
 * The site header is part of cached pages, so it can't read the session on
 * the server. The account menu calls this from the browser instead. Never
 * cached (Cache-Control: no-store), and returns no personal data.
 *
 * TODO(BUN-186): return the customer's first name once auth is in place.
 */
export async function GET() {
  const session = await getSession();
  return Response.json(
    { signedIn: session !== null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
