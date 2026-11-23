import "server-only";
import { emailConfig } from "@/lib/env.server";

/**
 * Account emails (BUN-187): email verification now, password reset
 * (BUN-188) and order emails (BUN-202) later.
 *
 * Sent through SMTP (SMTP_URL, EMAIL_FROM). In local development without
 * SMTP, the email is written to the server log instead, so links can be
 * followed by hand.
 */
export type Email = { to: string; subject: string; text: string; html: string };

const globalForMail = globalThis as unknown as {
  buntalkMailer?: Promise<{ sendMail: (m: object) => Promise<unknown> }>;
};

export async function sendEmail(email: Email): Promise<void> {
  const config = emailConfig();
  if (config.kind === "log") {
    console.info(
      `[email] To: ${email.to}\n[email] Subject: ${email.subject}\n${email.text
        .split("\n")
        .map((line) => `[email] ${line}`)
        .join("\n")}`,
    );
    return;
  }
  globalForMail.buntalkMailer ??= import("nodemailer").then((m) => m.createTransport(config.url));
  const mailer = await globalForMail.buntalkMailer;
  await mailer.sendMail({ from: config.from, ...email });
}
