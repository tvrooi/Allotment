import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

// Server mode is read from the environment when modules load, so set it first
process.env.FLYBUDGET_SERVER_MODE = 'true';
process.env.SUPERVISOR_TOKEN = 'test-supervisor-token';

const sent: string[] = [];
let dismissed = 0;
vi.mock('../auth/resetNotify.js', () => ({
  canNotifyHomeAssistant: () => true,
  notifyResetCode: async (code: string) => void sent.push(code),
  dismissResetNotification: async () => void dismissed++,
}));

const express = (await import('express')).default;
const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
const { db } = await import('../db/index.js');
const { authRouter, requireSession } = await import('./auth.js');
const { setupCode } = await import('../auth/setupCode.js');
const { issueResetCode, consumeResetCode, clearResetCode, RESET_CODE_TTL_MS } =
  await import('../auth/resetCode.js');

let server: Server;
let base: string;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api', requireSession);
  app.get('/api/accounts', (_req, res) => res.json([{ name: 'secret account' }]));
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

const post = (path: string, body: unknown, cookie?: string) =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
const get = (path: string, cookie?: string) =>
  fetch(base + path, { headers: cookie ? { cookie } : {} });
const sessionCookie = (res: Response) => res.headers.get('set-cookie')?.split(';')[0];

describe('reset code', () => {
  it('works once, expires after 24 hours, and a repeat request gets the same live code', () => {
    clearResetCode();
    const code = issueResetCode(1000);
    expect(code).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(issueResetCode(2000)).toBe(code);
    expect(consumeResetCode('AAAA-AAAA-AAAA-AAAA', 3000)).toBe(false);
    expect(consumeResetCode(code.toLowerCase().replace(/-/g, ' '), 3000)).toBe(true);
    expect(consumeResetCode(code, 3000)).toBe(false);
    const next = issueResetCode(5000);
    expect(next).not.toBe(code);
    expect(consumeResetCode(next, 5000 + RESET_CODE_TTL_MS)).toBe(false);
    // Expired: a request makes a new one
    expect(issueResetCode(5000 + RESET_CODE_TTL_MS)).not.toBe(next);
    clearResetCode();
  });
});

describe('forgot password on a single-user server', () => {
  let oldSession: string;

  it('is not offered, and refuses, until a password exists', async () => {
    expect(await (await get('/auth/status')).json()).not.toHaveProperty('canRecover');
    expect((await post('/auth/forgot', {})).status).toBe(409);
    const res = await post('/auth/setup', {
      password: 'first password 123',
      setupCode: setupCode(),
    });
    oldSession = sessionCookie(res)!;
    expect(await (await get('/auth/status')).json()).toMatchObject({
      canRecover: true,
      canNotify: true,
    });
  });

  it('prints the code to the log and sends it to Home Assistant, without returning it', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const res = await post('/auth/forgot', {});
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/[A-Z2-9]{4}-[A-Z2-9]{4}/);
    expect(body).toEqual({ canNotify: true });
    const printed = log.mock.calls.map((c) => String(c[0])).join('');
    log.mockRestore();
    const code = printed.match(/[A-Z2-9]{4}(?:-[A-Z2-9]{4}){3}/)![0];
    expect(sent).toEqual([code]);
    // Asking again does not replace the code the owner is about to type
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await post('/auth/forgot', {});
    vi.restoreAllMocks();
    expect(sent).toEqual([code, code]);
    (globalThis as { __resetCode?: string }).__resetCode = code;
  });

  it('refuses a wrong code and a weak password, and changes nothing', async () => {
    expect(
      (await post('/auth/reset', { code: 'AAAA-BBBB-CCCC-DDDD', password: 'brand new pass 1' }))
        .status,
    ).toBe(403);
    const code = (globalThis as { __resetCode?: string }).__resetCode!;
    expect((await post('/auth/reset', { code, password: 'short' })).status).toBe(400);
    expect((await post('/auth/login', { password: 'first password 123' })).status).toBe(204);
  });

  it('resets once: signs every session out, signs this browser in, and spends the code', async () => {
    const code = (globalThis as { __resetCode?: string }).__resetCode!;
    expect((await get('/accounts', oldSession)).status).toBe(200);
    const res = await post('/auth/reset', { code, password: 'brand new pass 1' });
    expect(res.status).toBe(204);
    const fresh = sessionCookie(res)!;
    expect(fresh).toMatch(/^flybudget_session=/);
    expect((await get('/accounts', fresh)).status).toBe(200);
    expect((await get('/accounts', oldSession)).status).toBe(401);
    expect((await post('/auth/login', { password: 'first password 123' })).status).toBe(401);
    expect((await post('/auth/login', { password: 'brand new pass 1' })).status).toBe(204);
    expect(dismissed).toBe(1);
    // Single use
    expect((await post('/auth/reset', { code, password: 'another new pass 2' })).status).toBe(403);
  });

  it('limits how often codes can be requested', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await post('/auth/forgot', {})).status);
    vi.restoreAllMocks();
    // Two earlier requests in this file count, so the limit arrives within the loop
    expect(statuses).toContain(429);
  });
});
