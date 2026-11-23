/**
 * Usernames (BUN-187): 3 to 30 letters, numbers, dots or underscores, starting
 * with a letter or number. Stored in lower case, so "Nimal.P" signs in as
 * "nimal.p". Shared by the sign-up form and the server.
 */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._]{2,29}$/i;

/** Why a username isn't accepted, or null. */
export function usernameProblem(value: string): string | null {
  if (value.length < 3) return "Use at least 3 characters.";
  if (value.length > 30) return "Use at most 30 characters.";
  if (!USERNAME_PATTERN.test(value)) {
    return "Use letters, numbers, dots or underscores, starting with a letter or number.";
  }
  return null;
}
