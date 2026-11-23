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
  // No automatic redirect after a call: sign-in sends a `callbackURL` only for the
  // email-confirmation link (an unconfirmed account gets a new one), and the forms
  // decide where to go afterwards. Google / Apple sign-in (BUN-189/190) navigate
  // to the provider themselves.
  disableDefaultFetchPlugins: true,
});
