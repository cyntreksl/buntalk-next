"use client";

import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Sign-in calls from the browser (BUN-186), to /api/auth on this site, with
 * username sign-in (BUN-187). Use it only in features/auth; pages read the
 * session on the server (lib/auth/index.ts).
 */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [usernameClient()],
});
