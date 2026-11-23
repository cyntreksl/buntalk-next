import type { Email } from "@/lib/email";

/** Account emails (BUN-187): plain text and simple HTML, in the site's voice. */

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(heading: string, paragraphs: string[], button?: { label: string; url: string }) {
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#FFF8EC;font-family:Arial,Helvetica,sans-serif;color:#2A1810">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
<p style="margin:0 0 16px;font-size:20px;font-weight:bold;color:#7A3A12">Buntalk</p>
<h1 style="margin:0 0 16px;font-size:22px">${escape(heading)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5">${escape(p)}</p>`).join("\n")}
${
  button
    ? `<p style="margin:24px 0"><a href="${escape(button.url)}" style="display:inline-block;background:#C2410C;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px">${escape(button.label)}</a></p>
<p style="margin:0;font-size:13px;color:#6B5B53">Or copy this link into your browser:<br>${escape(button.url)}</p>`
    : ""
}
</div></body></html>`;
  const text = [
    heading,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...(button ? [`${button.label}: ${button.url}`] : []),
  ]
    .join("\n")
    .trim();
  return { html, text };
}

/** "Confirm your email": sent on sign-up and when an unverified account tries to sign in. */
export function verifyEmail(to: string, name: string, url: string): Email {
  return {
    to,
    subject: "Confirm your email for Buntalk",
    ...layout(
      `Hi ${name}, please confirm your email`,
      [
        "Thanks for creating a Buntalk account. Confirm that this is your email address to finish, and you'll be signed in.",
        "The link works for 24 hours. If you didn't create an account, you can ignore this email.",
      ],
      { label: "Confirm my email", url },
    ),
  };
}

/**
 * Someone tried to create an account with an email that already has one. The
 * sign-up page doesn't say so (it would show who has an account); the owner
 * is told here instead.
 */
export function alreadyRegistered(to: string, name: string, signInUrl: string): Email {
  return {
    to,
    subject: "You already have a Buntalk account",
    ...layout(
      `Hi ${name}, you already have an account`,
      [
        "Someone, probably you, just tried to create a Buntalk account with this email address. You already have one, so nothing has changed.",
        "If it was you, sign in with your email or username. If it wasn't, you can ignore this email.",
      ],
      { label: "Sign in", url: signInUrl },
    ),
  };
}
