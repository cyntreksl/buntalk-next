/**
 * Password rules (BUN-187), shared by the sign-up form (shown as a checklist
 * while typing) and the server (which enforces them). Passwords are hashed
 * with scrypt by Better Auth and never stored as typed.
 *
 * - 8 to 128 characters;
 * - at least one letter and one number (or 16+ characters, for passphrases);
 * - not one of the most common passwords;
 * - not containing the email name or the username.
 */

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** The most common passwords and close variants (checked case-insensitively, as typed). */
const COMMON = new Set([
  "password",
  "password1",
  "password12",
  "password123",
  "passw0rd",
  "p@ssw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "12341234",
  "11111111",
  "00000000",
  "87654321",
  "qwerty123",
  "qwertyuiop",
  "1q2w3e4r",
  "1qaz2wsx",
  "asdf1234",
  "abc12345",
  "abcd1234",
  "iloveyou1",
  "welcome1",
  "welcome123",
  "letmein1",
  "admin123",
  "football1",
  "sunshine1",
  "princess1",
  "monkey123",
  "dragon123",
  "baseball1",
  "trustno1",
  "superman1",
  "buntalk1",
  "buntalk123",
  "colombo123",
  "srilanka1",
  "srilanka123",
]);

export type PasswordCheck = { id: string; label: string; ok: boolean };

/** Each rule, and whether the password meets it (for the checklist). */
export function passwordChecks(
  password: string,
  context: { email?: string; username?: string } = {},
): PasswordCheck[] {
  const lower = password.toLowerCase();
  const personal = [context.email?.split("@")[0], context.username]
    .map((v) => v?.trim().toLowerCase())
    .filter((v): v is string => Boolean(v) && v!.length >= 3);
  return [
    {
      id: "length",
      label: `At least ${PASSWORD_MIN} characters`,
      ok: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    },
    {
      id: "mix",
      label: "A letter and a number",
      ok: password.length >= 16 || (/\p{L}/u.test(password) && /\p{N}/u.test(password)),
    },
    {
      id: "common",
      label: "Not a common password",
      ok: password.length > 0 && !COMMON.has(lower),
    },
    {
      id: "personal",
      label: "Not your email or username",
      ok: password.length > 0 && !personal.some((p) => lower.includes(p)),
    },
  ];
}

/** Why a password isn't accepted (the first failed rule), or null when it's fine. */
export function passwordProblem(
  password: string,
  context: { email?: string; username?: string } = {},
): string | null {
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  const failed = passwordChecks(password, context).find((c) => !c.ok);
  if (!failed) return null;
  return {
    length: `Use at least ${PASSWORD_MIN} characters.`,
    mix: "Use at least one letter and one number (or 16 characters or more).",
    common: "That password is too common. Choose another one.",
    personal: "Don't use your email or username in your password.",
  }[failed.id]!;
}
