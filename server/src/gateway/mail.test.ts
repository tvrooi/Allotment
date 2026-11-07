import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTransport } from 'nodemailer';
import { EMAIL_ADDRESS, smtpMailer, smtpTransportOptions, type SmtpSettings } from './mail.js';

// Password codes by email (docs/MULTI-USER-EMAIL-AND-REMINDERS.md): what is sent, and how the
// connection is made. Messages go through Nodemailer's stream transport; nothing connects.

const settings: SmtpSettings = {
  host: 'smtp.example.com',
  port: 587,
  security: 'starttls',
  username: 'allotment',
  password: 'mail-password',
  from: 'allotment@example.com',
};

afterEach(() => vi.restoreAllMocks());

describe('email for password codes', () => {
  it('always uses TLS with a checked certificate, and never carries on unencrypted', () => {
    const starttls = smtpTransportOptions(settings);
    expect(starttls).toMatchObject({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      requireTLS: true,
      ignoreTLS: false,
      tls: { rejectUnauthorized: true, servername: 'smtp.example.com' },
      auth: { user: 'allotment', pass: 'mail-password' },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
      logger: false,
    });
    expect(smtpTransportOptions({ ...settings, port: 465, security: 'tls' })).toMatchObject({
      secure: true,
      tls: { rejectUnauthorized: true },
    });
    // A relay that needs no login
    expect(smtpTransportOptions({ ...settings, username: undefined }).auth).toBeUndefined();
  });

  it('sends plain SMTP only to a mail catcher on this machine', () => {
    expect(() => smtpTransportOptions({ ...settings, security: 'none' })).toThrow(/this machine/);
    expect(() =>
      smtpTransportOptions({ ...settings, host: '192.168.1.5', security: 'none' }),
    ).toThrow();
    expect(
      smtpTransportOptions({ ...settings, host: '127.0.0.1', security: 'none' }),
    ).toMatchObject({ secure: false, requireTLS: false, ignoreTLS: true });
  });

  it('sends one plain-text message from Allotment, with no link and nothing fetched', async () => {
    const transport = createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    const sent: string[] = [];
    const send = transport.sendMail.bind(transport);
    vi.spyOn(transport, 'sendMail').mockImplementation(async (message) => {
      const info = await send(message);
      sent.push(info.message.toString());
      return info;
    });
    await smtpMailer(settings, transport)(
      'edward@example.com',
      'Allotment password code',
      'Your Allotment code is 123456. It works once, for 10 minutes.',
    );
    const [raw] = sent;
    expect(raw).toMatch(/^From: Allotment <allotment@example\.com>$/m);
    expect(raw).toMatch(/^To: edward@example\.com$/m);
    expect(raw).toMatch(/^Subject: Allotment password code$/m);
    expect(raw).toMatch(/^Content-Type: text\/plain; charset=utf-8$/m);
    expect(raw).toContain('Your Allotment code is 123456.');
    expect(raw).not.toMatch(/https?:|text\/html|attachment/i);
    // Neither the password nor anything else of the settings is in the message
    expect(raw).not.toContain('mail-password');
  });

  it('reports a failed send without the address or the password', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = {
      sendMail: async () => {
        throw Object.assign(new Error('550 <edward@example.com> rejected'), {
          code: 'EENVELOPE',
          responseCode: 550,
        });
      },
    };
    await expect(smtpMailer(settings, failing)('edward@example.com', 's', 't')).rejects.toThrow(
      'The email could not be sent',
    );
    const logged = error.mock.calls.flat().join(' ');
    expect(logged).toContain('EENVELOPE');
    expect(logged).toContain('550');
    expect(logged).not.toMatch(/edward|mail-password/);
  });

  it('takes an email address as typed, trimmed, and nothing that could add a header', () => {
    expect(EMAIL_ADDRESS.parse(' edward@example.com ')).toBe('edward@example.com');
    for (const bad of [
      'edward',
      'edward@example.com\r\nBcc: other@example.com',
      'Edward <edward@example.com>',
      `${'a'.repeat(250)}@example.com`,
    ])
      expect(EMAIL_ADDRESS.safeParse(bad).success).toBe(false);
  });
});
