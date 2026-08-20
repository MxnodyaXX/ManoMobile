import nodemailer from "nodemailer";

/**
 * SMTP transport. Server-only — importing this from a client component would
 * put the password in the browser bundle.
 *
 * SMTP rather than an email API (Resend, SendGrid, Brevo) because the shop is
 * sending from a personal address on a domain it does not own. A third-party
 * sender cannot sign mail as @gmail.com: Gmail publishes a DMARC policy, so
 * mail claiming to be from a gmail.com address but sent through someone else's
 * servers fails alignment and lands in spam or is rejected outright.
 *
 * Sending through the mailbox's own SMTP server avoids that entirely — the mail
 * really is from that account. When Mano Mobile buys a domain, the same code
 * points at that mailbox's SMTP, or at an API provider's SMTP relay, by
 * changing four environment variables.
 */

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  configured: boolean;
}

export function getSmtpConfig(): SmtpConfig {
  const host = (process.env.SMTP_HOST ?? "").trim();
  const user = (process.env.SMTP_USER ?? "").trim();
  // Google shows an App Password as four groups of four ("abcd efgh ijkl mnop")
  // and everyone pastes it that way, but SMTP auth fails unless the spaces are
  // removed. Stripping here saves a confusing "Username and Password not
  // accepted" against a password that is, in fact, correct.
  const password = (process.env.SMTP_PASSWORD ?? "").replace(/\s+/g, "");
  // 587 with STARTTLS is what Gmail, Outlook and most hosts expect.
  const port = Number(process.env.SMTP_PORT ?? 587);

  return {
    host, port, user, password,
    configured: Boolean(host && user && password),
  };
}

let transport: nodemailer.Transporter | undefined;

function getTransport(cfg: SmtpConfig) {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      // 465 is implicit TLS; 587 starts plain and upgrades via STARTTLS.
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.password },
    });
  }
  return transport;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export async function sendMail(opts: {
  from: string;
  replyTo?: string;
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const cfg = getSmtpConfig();
  if (!cfg.configured) {
    return { ok: false, error: "SMTP is not configured on the server." };
  }

  try {
    await getTransport(cfg).sendMail({
      from: opts.from,
      replyTo: opts.replyTo || undefined,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      // A plain-text fallback stops spam filters marking the mail down for
      // being HTML-only, and it is what a watch or a screen reader shows.
      text: htmlToText(opts.html),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Good enough for the alternative part: block tags become line breaks, the
 *  rest is stripped. Not a general HTML parser and does not need to be. */
function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|tr|div|h[1-6])\s*>/gi, "\n")
    .replace(/<\/\s*td\s*>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Rejects the obvious mistakes without pretending to validate deliverability;
 *  only a send can tell you that. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
