import { getAuth } from "@/lib/auth/server";

/**
 * Better Auth's endpoints (BUN-186): sign-in, sign-up, sign-out, session,
 * linked sign-in methods. Called by the browser through lib/auth/client.ts.
 * Never cached.
 */
const handle = async (request: Request) => (await getAuth()).handler(request);

export const GET = handle;
export const POST = handle;
