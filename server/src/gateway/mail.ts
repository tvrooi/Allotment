import { createTransport } from 'nodemailer';
import type { SendMailOptions, Transporter } from 'nodemailer/lib/mailer';
import type { SMTPTransportOptions } from 'nodemailer/lib/smtp-transport';
import { z } from 'zod';

// Password codes by email (docs/MULTI-USER-EMAIL-AND-REMINDERS.md), beside notify.ts. The
// mail server is set once in the app's Home Assistant options; ha-launch.cjs hands it to the
// gateway as a value, never through the environment, so no budget process sees the password.
// Plain text only, fixed subjects and no links, so a real code email never looks like the
// phishing kind.

export interface SmtpSettings {
  host: string;
  port: number;
  /**
   * `tls` (usually port 465) or `starttls` (usually 587), the certificate always checked.
   * `none` is plain SMTP, allowed only to a mail catcher on this machine (development, tests).
   */
  security: 'tls' | 'starttls' | 'none';
  username?: string;
  password?: string;
  from: string;
}

export type Mailer = (to: string, subject: string, text: string) => Promise<void>;

/** A person's email address, as typed: trimmed, at most 254 characters */
export const EMAIL_ADDRESS = z.string().trim().max(254).pipe(z.email());

const TIMEOUT_MS = 10_000;
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

/** Nodemailer's SMTP settings: TLS required and verified, short timeouts, nothing logged */
export function smtpTransportOptions(s: SmtpSettings): SMTPTransportOptions {
  if (s.security === 'none' && !LOOPBACK.has(s.host))
    throw new Error('Unencrypted email is only for a mail catcher on this machine');
  return {
    host: s.host,
    port: s.port,
    secure: s.security === 'tls',
    // STARTTLS or nothing: never carry on unencrypted when the upgrade fails
    requireTLS: s.security === 'starttls',
    ignoreTLS: s.security === 'none',
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: s.host },
    auth: s.username ? { user: s.username, pass: s.password ?? '' } : undefined,
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
    logger: false,
    debug: false,
  };
}

/** One plain-text message from the app's address, which can't read files or fetch anything */
export function mailMessage(
  from: string,
  to: string,
  subject: string,
  text: string,
): SendMailOptions {
  return {
    from: { name: 'Allotment', address: from },
    to,
    subject,
    text,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
}

/** Sends through the configured mail server. `transport` is for tests. */
export function smtpMailer(
  s: SmtpSettings,
  transport: Pick<Transporter, 'sendMail'> = createTransport(smtpTransportOptions(s)),
): Mailer {
  return async (to, subject, text) => {
    try {
      await transport.sendMail(mailMessage(s.from, to, subject, text));
    } catch (e) {
      // Only Nodemailer's error code and the server's reply code: its message can quote the
      // recipient's address
      const { code, responseCode } = e as { code?: unknown; responseCode?: unknown };
      console.error(
        `An email could not be sent (${typeof code === 'string' ? code : 'error'}${typeof responseCode === 'number' ? `, server reply ${responseCode}` : ''})`,
      );
      throw new Error('The email could not be sent');
    }
  };
}
