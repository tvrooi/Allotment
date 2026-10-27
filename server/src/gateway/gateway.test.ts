import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

// The multi-user gateway (docs/MULTI-USER-PLAN.md) with real budget processes: each person's
// FlyBudget server runs from source on loopback, with its own made-up empty database.

process.env.FLYBUDGET_SERVER_MODE = 'true';
const { createGateway } = await import('./app.js');
const { Budgets, processLauncher } = await import('./budgets.js');
const { GatewayStore } = await import('./store.js');
const { setupCode } = await import('../auth/setupCode.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flybudget-gateway-'));
const store = new GatewayStore(path.join(dir, 'people.db'));
const budgets = new Budgets(
  processLauncher(path.resolve('src/index.ts'), ['--import', 'tsx']),
  // Away from other tests' ports
  24_100 + Math.floor(Math.random() * 500),
  90_000,
);
const notices: { service: string; message: string }[] = [];
const logged: string[] = [];
let server: Server;
let base: string;

beforeAll(async () => {
  const app = createGateway({
    store,
    budgets,
    ownerBudget: { dbPath: path.join(dir, 'budget.db'), keyPath: path.join(dir, 'owner.key') },
    budgetsDir: path.join(dir, 'budgets'),
    notify: async (service, _title, message) => void notices.push({ service, message }),
    canNotify: () => true,
    log: (m) => void logged.push(m),
  });
  // The owner's key, as the launcher would have made it
  fs.writeFileSync(path.join(dir, 'owner.key'), Buffer.alloc(32, 7).toString('base64'));
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 120_000);

afterAll(async () => {
  server?.close();
  await budgets.stopAll();
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

/** A browser: keeps its own session cookie */
function browser() {
  let cookie = '';
  return async (
    method: string,
    url: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = res.headers.get('set-cookie');
    if (set?.startsWith('flybudget_session=')) cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}

const owner = browser();
const partner = browser();
const stranger = browser();
let partnerId = '';
let ownerToken = '';

describe('multi-user gateway', () => {
  it('sets up the first person as administrator, with the budget that was already there', async () => {
    expect((await owner('GET', '/api/auth/status')).body).toMatchObject({
      enabled: true,
      multiUser: true,
      needsSetup: true,
      authenticated: false,
    });
    expect(
      (
        await owner('POST', '/api/auth/setup', {
          name: 'Tristan',
          password: 'owner-pass-1',
          setupCode: 'NOPE',
        })
      ).status,
    ).toBe(403);
    const setup = await owner('POST', '/api/auth/setup', {
      name: 'Tristan',
      password: 'owner-pass-1',
      setupCode: setupCode(),
    });
    expect(setup.status).toBe(204);
    expect((await owner('GET', '/api/auth/status')).body).toMatchObject({
      needsSetup: false,
      authenticated: true,
      person: { name: 'Tristan', isAdmin: true },
    });
    const made = await owner('POST', '/api/accounts', {
      name: 'Everyday',
      type: 'checking',
      startingBalance: 12_345,
    });
    expect(made.status).toBe(201);
    expect((await owner('GET', '/api/accounts')).body.map((a: { name: string }) => a.name)).toEqual(
      ['Everyday'],
    );
    // Setup can't be repeated
    expect(
      (
        await stranger('POST', '/api/auth/setup', {
          name: 'X',
          password: 'whatever-1',
          setupCode: setupCode(),
        })
      ).status,
    ).toBe(409);
  }, 120_000);

  it('invites a second person, whose budget is their own and empty', async () => {
    const added = await owner('POST', '/api/people', { name: 'Edward' });
    expect(added.status).toBe(201);
    partnerId = added.body.person.id;
    expect(added.body.inviteCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/);
    expect(
      (
        await partner('POST', '/api/auth/accept-invite', {
          name: 'edward',
          code: 'WRONG',
          password: 'partner-pw-1',
        })
      ).status,
    ).toBe(401);
    const accepted = await partner('POST', '/api/auth/accept-invite', {
      name: ' edward ',
      code: added.body.inviteCode,
      password: 'partner-pw-1',
    });
    expect(accepted.status).toBe(204);
    // Their own budget: none of the owner's accounts
    expect((await partner('GET', '/api/accounts')).body).toEqual([]);
    await partner('POST', '/api/accounts', {
      name: 'Edward savings',
      type: 'savings',
      startingBalance: 1,
    });
    expect((await owner('GET', '/api/accounts')).body.map((a: { name: string }) => a.name)).toEqual(
      ['Everyday'],
    );
    // Only the administrator manages people
    expect((await partner('GET', '/api/people')).status).toBe(403);
    expect((await partner('POST', '/api/people', { name: 'Someone' })).status).toBe(403);
  }, 120_000);

  it("reports the gateway's sign-in in Settings → Server, not a missing budget password", async () => {
    const info = await partner('GET', '/api/server/info');
    expect(info.body.mode).toBe('server');
    expect(info.body.checks.find((c: { id: string }) => c.id === 'password')).toMatchObject({
      ok: true,
    });
  });

  it('never lets a request in without a session, whatever headers it brings', async () => {
    expect((await stranger('GET', '/api/accounts')).status).toBe(401);
    const forged = await stranger('GET', '/api/accounts', undefined, {
      'x-flybudget-gateway': 'guess',
      Cookie: 'flybudget_session=made-up',
    });
    expect(forged.status).toBe(401);
    // A budget itself refuses anything without the gateway's secret
    const port = budgets.port(partnerId)!;
    const direct = await fetch(`http://127.0.0.1:${port}/api/accounts`);
    expect(direct.status).toBe(401);
    const wrong = await fetch(`http://127.0.0.1:${port}/api/accounts`, {
      headers: { 'x-flybudget-gateway': 'x'.repeat(budgets.secret.length) },
    });
    expect(wrong.status).toBe(401);
    // Its own login is closed behind the gateway
    expect((await fetch(`http://127.0.0.1:${port}/api/auth/status`)).status).toBe(404);
  });

  it('routes an access token to the budget that issued it, and only there', async () => {
    const made = await owner('POST', '/api/access-tokens', { name: 'Assistant', days: 7 });
    expect(made.status).toBe(201);
    ownerToken = made.body.token;
    const owners = store.people().find((p) => p.isAdmin)!;
    expect(ownerToken.startsWith(`fbro_${owners.id}_`)).toBe(true);
    const read = await stranger('GET', '/api/accounts', undefined, {
      Authorization: `Bearer ${ownerToken}`,
    });
    expect(read.body.map((a: { name: string }) => a.name)).toEqual(['Everyday']);
    // The same token pointed at the partner's id is just an invalid token there
    const moved = ownerToken.replace(owners.id, partnerId);
    expect(
      (await stranger('GET', '/api/accounts', undefined, { Authorization: `Bearer ${moved}` }))
        .status,
    ).toBe(401);
  });

  it('resets a forgotten password with a code sent to the phone', async () => {
    expect(
      (await partner('PUT', '/api/people/me/notify', { service: 'notify.mobile_app_edward' })).body,
    ).toEqual({
      notifyService: 'mobile_app_edward',
    });
    const asked = await stranger('POST', '/api/auth/forgot', { name: 'Edward' });
    expect(asked.status).toBe(202);
    // Unknown names get the same answer and send nothing
    const unknown = await stranger('POST', '/api/auth/forgot', { name: 'Nobody' });
    expect(unknown).toEqual(asked);
    expect(notices).toHaveLength(1);
    expect(notices[0].service).toBe('mobile_app_edward');
    const code = /code is (\d{6})/.exec(notices[0].message)![1];
    const reset = browser();
    expect(
      (
        await reset('POST', '/api/auth/reset', {
          name: 'Edward',
          code: '000000',
          password: 'new-partner-1',
        })
      ).status,
    ).toBe(code === '000000' ? 204 : 401);
    if (code !== '000000')
      expect(
        (
          await reset('POST', '/api/auth/reset', {
            name: 'Edward',
            code,
            password: 'new-partner-1',
          })
        ).status,
      ).toBe(204);
    // Used up; the old session and password no longer work
    expect(
      (await reset('POST', '/api/auth/reset', { name: 'Edward', code, password: 'again-again-1' }))
        .status,
    ).toBe(401);
    expect((await partner('GET', '/api/accounts')).status).toBe(401);
    expect(
      (await stranger('POST', '/api/auth/login', { name: 'Edward', password: 'partner-pw-1' }))
        .status,
    ).toBe(401);
    expect(
      (await partner('POST', '/api/auth/login', { name: 'Edward', password: 'new-partner-1' }))
        .status,
    ).toBe(204);
    expect((await partner('GET', '/api/accounts')).body[0].name).toBe('Edward savings');
  });

  it("lets the administrator issue a reset code to the Log, never a way into someone's budget", async () => {
    expect((await owner('POST', `/api/people/${partnerId}/reset-code`)).status).toBe(204);
    expect(logged.at(-1)).toMatch(/Password reset code for Edward: [A-Z2-9-]{19}/);
    // The administrator's own forgotten password: a code in the Log when no phone is set
    await stranger('POST', '/api/auth/forgot', { name: 'Tristan' });
    expect(logged.at(-1)).toMatch(/Password reset code for Tristan/);
  });

  it('disables a person: signed out, no sign-in, budget stopped', async () => {
    expect((await owner('POST', `/api/people/${partnerId}/disable`)).body).toMatchObject({
      disabled: true,
      running: false,
    });
    expect((await partner('GET', '/api/accounts')).status).toBe(401);
    expect(
      (await partner('POST', '/api/auth/login', { name: 'Edward', password: 'new-partner-1' }))
        .status,
    ).toBe(401);
    expect((await owner('POST', `/api/people/${partnerId}/enable`)).body).toMatchObject({
      disabled: false,
      running: true,
    });
  }, 120_000);

  it("changing a password signs out other devices and revokes that person's access tokens", async () => {
    const other = browser();
    await other('POST', '/api/auth/login', { name: 'Tristan', password: 'owner-pass-1' });
    expect(
      (
        await owner('POST', '/api/auth/change-password', {
          currentPassword: 'owner-pass-1',
          newPassword: 'owner-pass-2',
        })
      ).status,
    ).toBe(204);
    expect((await owner('GET', '/api/accounts')).status).toBe(200);
    expect((await other('GET', '/api/accounts')).status).toBe(401);
    // Revoked by the budget, asked by the gateway
    await new Promise((r) => setTimeout(r, 300));
    const read = await stranger('GET', '/api/accounts', undefined, {
      Authorization: `Bearer ${ownerToken}`,
    });
    expect(read.status).toBe(401);
  });
});
