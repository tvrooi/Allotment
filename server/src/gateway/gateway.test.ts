import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { Server } from 'http';

// The multi-user gateway (docs/MULTI-USER-PLAN.md) with real budget processes: each person's
// Allotment server runs from source on loopback, with its own made-up empty database.

process.env.FLYBUDGET_SERVER_MODE = 'true';
const { bankCallbackPerson, createGateway } = await import('./app.js');
const { Budgets, processLauncher } = await import('./budgets.js');
const { createNotifyListener } = await import('./notifyListener.js');
const { GatewayStore } = await import('./store.js');
const { setupCode } = await import('../auth/setupCode.js');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flybudget-gateway-'));
const store = new GatewayStore(path.join(dir, 'people.db'));
// Away from other tests' ports; the budgets hand reminders to the port below their first
const budgetPort = 24_100 + Math.floor(Math.random() * 500);
const notifyPort = budgetPort - 1;
const budgets = new Budgets(
  processLauncher(
    path.resolve('src/index.ts'),
    ['--import', 'tsx'],
    `http://127.0.0.1:${notifyPort}/notify`,
  ),
  budgetPort,
  90_000,
);
let notifyFails = false;
const notices: { service: string; message: string }[] = [];
const mails: { to: string; subject: string; text: string }[] = [];
let notifyOn = true;
const logged: string[] = [];
let server: Server;
let notifyServer: Server;
let base: string;

const gatewayOptions = () => ({
  store,
  budgets,
  ownerBudget: { dbPath: path.join(dir, 'budget.db'), keyPath: path.join(dir, 'owner.key') },
  budgetsDir: path.join(dir, 'budgets'),
  notify: async (service: string, _title: string, message: string) => {
    if (notifyFails) throw new Error('Home Assistant could not send it (error 500)');
    notices.push({ service, message });
  },
  canNotify: () => notifyOn,
  mail: async (to: string, subject: string, text: string) => void mails.push({ to, subject, text }),
  log: (m: string) => void logged.push(m),
});

beforeAll(async () => {
  const app = createGateway(gatewayOptions());
  // The owner's key, as the launcher would have made it
  fs.writeFileSync(path.join(dir, 'owner.key'), Buffer.alloc(32, 7).toString('base64'));
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  notifyServer = await new Promise<Server>((r) => {
    const s = createNotifyListener(gatewayOptions()).listen(notifyPort, '127.0.0.1', () => r(s));
  });
}, 120_000);

afterAll(async () => {
  server?.close();
  notifyServer?.close();
  await budgets.stopAll();
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

/** As if a few minutes had passed since every code was sent (the once-a-minute limit) */
const later = () =>
  store.db
    .prepare(
      "update code_sends set sent_at = strftime('%Y-%m-%dT%H:%M:%fZ', sent_at, '-2 minutes')",
    )
    .run();
/**
 * Forgot password, through a gateway of its own on the same people.db: each has its own limit
 * per IP address (5 every 15 minutes), which these tests would otherwise use up
 */
async function forgot(name: string) {
  const app = createGateway(gatewayOptions());
  const other = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  try {
    const res = await fetch(
      `http://127.0.0.1:${(other.address() as AddressInfo).port}/api/auth/forgot`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      },
    );
    return { status: res.status, body: await res.json() };
  } finally {
    other.close();
  }
}
const sixDigits = (text: string) => /(\d{6})/.exec(text)![1];

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

  it('combines two households, one in each budget, only once both agree', async () => {
    const ownerId = (await owner('GET', '/api/auth/status')).body.person.id;
    // Each keeps a household in their own budget
    const home = (
      await owner('POST', '/api/households', {
        name: 'Home',
        currency: 'AUD',
        people: ['Tristan', 'Edward', 'Sam'],
        selfIndex: 0,
      })
    ).body;
    const [me, ed, sam] = home.people;
    const privateGroup = await owner('POST', '/api/categories/groups', {
      name: 'Private group',
      isIncome: 0,
    });
    expect(privateGroup.status).toBe(201);
    const added = await owner('POST', `/api/households/${home.group.id}/events`, {
      kind: 'expense',
      date: '2026-10-01',
      description: 'Groceries',
      amount: 9_000,
      payerId: me.id,
      shares: [ed, me, sam].map((p: { id: string }) => ({ personId: p.id, value: 1 })),
      mode: 'weight',
    });
    expect(added.status).toBe(201);
    const ours = (
      await partner('POST', '/api/households', {
        name: 'Our place',
        currency: 'AUD',
        people: ['Edward', 'Tristan'],
        selfIndex: 0,
      })
    ).body;
    const [edSelf, edTristan] = ours.people;
    await partner('POST', `/api/households/${ours.group.id}/events`, {
      kind: 'expense',
      date: '2026-10-02',
      description: 'Electricity',
      amount: 20_000,
      payerId: edSelf.id,
      shares: [edSelf, edTristan].map((p: { id: string }) => ({ personId: p.id, value: 1 })),
      mode: 'weight',
    });

    // Not without signing in, nor without a choice of who they are in the household
    expect((await stranger('GET', '/api/shared-households')).status).toBe(401);
    const listed = (await owner('GET', '/api/shared-households')).body;
    expect(listed.people).toEqual([{ id: partnerId, name: 'Edward' }]);
    expect(
      (
        await owner('POST', '/api/shared-households', {
          partnerId,
          groupId: home.group.id,
          partnerPersonId: me.id,
        })
      ).status,
    ).toBe(400);
    const asked = await owner('POST', '/api/shared-households', {
      partnerId,
      groupId: home.group.id,
      partnerPersonId: ed.id,
    });
    expect(asked.status).toBe(201);
    const linkId = asked.body.id;
    // Asked, not yet agreed: nothing to see
    expect((await owner('GET', `/api/shared-households/${linkId}/register`)).status).toBe(400);
    expect((await partner('GET', '/api/shared-households')).body.links).toMatchObject([
      { id: linkId, role: 'invitee', status: 'pending', partner: { name: 'Tristan' } },
    ]);
    expect(
      (
        await partner('POST', `/api/shared-households/${linkId}/accept`, {
          groupId: ours.group.id,
          partnerPersonId: edTristan.id,
        })
      ).status,
    ).toBe(200);

    // Both see both households' entries, splits and the one person each of them is
    const register = (await partner('GET', `/api/shared-households/${linkId}/register`)).body;
    expect(
      register.entries.map((e: { description: string; mine: boolean }) => [e.description, e.mine]),
    ).toEqual([
      ['Electricity', true],
      ['Groceries', false],
    ]);
    expect(
      register.people.map((p: { name: string; balance: number }) => [p.name, p.balance]),
    ).toEqual([
      ['Tristan', 9_000 - 3_000 - 10_000],
      ['Edward', 20_000 - 10_000 - 3_000],
      ['Sam', -3_000],
    ]);
    // Nothing from the budgets beyond the household: no accounts, balances or categories
    const text = JSON.stringify(register);
    for (const leak of ['Everyday', '12345', 'Private group', 'Edward savings'])
      expect(text).not.toContain(leak);

    // One note per entry that either of them can edit
    const groceries = register.entries.find(
      (e: { description: string }) => e.description === 'Groceries',
    );
    expect(
      (
        await partner('PUT', `/api/shared-households/${linkId}/notes`, {
          ownerId: ownerId,
          eventId: groceries.eventId,
          text: 'Dinner with Sam',
        })
      ).status,
    ).toBe(204);
    await owner('PUT', `/api/shared-households/${linkId}/notes`, {
      ownerId: ownerId,
      eventId: groceries.eventId,
      text: 'Dinner with Sam and friends',
    });
    const seen = (await partner('GET', `/api/shared-households/${linkId}/register`)).body;
    expect(seen.entries.find((e: { key: string }) => e.key === groceries.key).note).toMatchObject({
      text: 'Dinner with Sam and friends',
      updatedBy: 'Tristan',
    });
    expect(
      (
        await owner('PUT', `/api/shared-households/${linkId}/notes`, {
          ownerId,
          eventId: 'not-an-entry',
          text: 'x',
        })
      ).status,
    ).toBe(400);
    // Neither budget's own records changed
    expect((await owner('GET', `/api/households/${home.group.id}`)).body.events).toHaveLength(1);

    // Either can stop it, and then neither sees the other's
    expect((await partner('DELETE', `/api/shared-households/${linkId}`)).status).toBe(204);
    expect((await owner('GET', `/api/shared-households/${linkId}/register`)).status).toBe(404);
    expect((await owner('GET', '/api/shared-households')).body.links).toEqual([]);

    // Two requests at once for the same household: only one is made
    const both = await Promise.all(
      [0, 1].map(() =>
        owner('POST', '/api/shared-households', {
          partnerId,
          groupId: home.group.id,
          partnerPersonId: ed.id,
        }),
      ),
    );
    expect(both.map((r) => r.status).sort()).toEqual([201, 400]);
    expect((await owner('GET', '/api/shared-households')).body.links).toHaveLength(1);
    await owner('DELETE', `/api/shared-households/${both.find((r) => r.status === 201)!.body.id}`);
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

  it("refuses a page's request when someone else has signed in on its browser since", async () => {
    const ownerId = (await owner('GET', '/api/auth/status')).body.person.id;
    // The partner's session, from a tab that still shows the owner's budget
    const stale = { 'x-flybudget-person': ownerId };
    for (const [method, url] of [
      ['GET', '/api/accounts'],
      ['POST', '/api/accounts'],
      ['GET', '/api/people'],
    ]) {
      const res = await partner(method, url, method === 'POST' ? { name: 'x' } : undefined, stale);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('person-changed');
    }
    expect(
      (await partner('GET', '/api/accounts')).body.map((a: { name: string }) => a.name),
    ).toEqual(['Edward savings']);
    const own = await partner('GET', '/api/accounts', undefined, {
      'x-flybudget-person': partnerId,
    });
    expect(own.status).toBe(200);
  });

  it("sends a bank's redirect back to the budget that started the login", async () => {
    const { makeState } = await import('../services/enableBankingTransactions.js');
    const people = store.people();
    const portOf = (id: string) => budgets.port(id);
    const random = 'r'.repeat(43);
    const partnerPort = budgets.port(partnerId)!;
    expect(bankCallbackPerson(people, portOf, makeState(partnerPort, random))?.id).toBe(partnerId);
    const admin = people.find((p) => p.isAdmin)!;
    expect(bankCallbackPerson(people, portOf, makeState(budgets.port(admin.id)!, random))?.id).toBe(
      admin.id,
    );
    // An old or unreadable state: the administrator's budget, which refuses an unknown one
    expect(bankCallbackPerson(people, portOf, 'nonsense')?.id).toBe(admin.id);
    expect(bankCallbackPerson(people, portOf, undefined)?.id).toBe(admin.id);
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
    // Any case of the scheme, as the budget itself accepts
    for (const scheme of ['bearer', 'BEARER']) {
      const res = await stranger('GET', '/api/accounts', undefined, {
        Authorization: `${scheme} ${ownerToken}`,
      });
      expect(res.status).toBe(200);
    }
    // The same token pointed at the partner's id is just an invalid token there
    const moved = ownerToken.replace(owners.id, partnerId);
    expect(
      (await stranger('GET', '/api/accounts', undefined, { Authorization: `Bearer ${moved}` }))
        .status,
    ).toBe(401);
  });

  it('resets a forgotten password with a code sent to the phone', async () => {
    // A phone is saved only once the code sent to it comes back
    expect(
      (await partner('POST', '/api/people/me/phone', { service: 'notify.mobile_app_edward' }))
        .status,
    ).toBe(202);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ service: 'mobile_app_edward' });
    expect((await partner('GET', '/api/auth/status')).body.person.notifyService).toBeNull();
    // Someone else can't confirm it
    const confirmCode = sixDigits(notices[0].message);
    expect(
      (await owner('POST', '/api/people/me/phone/confirm', { code: confirmCode })).status,
    ).toBe(400);
    expect(
      (await partner('POST', '/api/people/me/phone/confirm', { code: confirmCode })).body,
    ).toEqual({
      notifyService: 'mobile_app_edward',
      email: null,
      codeChannel: null,
      reminderChannel: null,
    });
    expect((await owner('GET', '/api/auth/status')).body.person.notifyService).toBeNull();
    notices.length = 0;
    later();

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

  it('sends codes by email to a confirmed address, where each person chose', async () => {
    expect((await partner('GET', '/api/auth/status')).body).toMatchObject({
      canNotify: true,
      canEmail: true,
    });
    expect((await partner('POST', '/api/people/me/email', { email: 'edward' })).status).toBe(400);
    expect(
      (await partner('POST', '/api/people/me/email', { email: ' edward@example.com ' })).status,
    ).toBe(202);
    expect(mails.at(-1)).toMatchObject({
      to: 'edward@example.com',
      subject: 'Allotment confirmation code',
    });
    expect(mails.at(-1)!.text).not.toMatch(/https?:/);
    const first = sixDigits(mails.at(-1)!.text);
    // Asking again straight away sends nothing
    expect(
      (await partner('POST', '/api/people/me/email', { email: 'other@example.com' })).status,
    ).toBe(429);
    expect(mails).toHaveLength(1);
    // Five wrong tries and the code stops working
    const wrong = first === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++)
      expect((await partner('POST', '/api/people/me/email/confirm', { code: wrong })).status).toBe(
        400,
      );
    expect((await partner('POST', '/api/people/me/email/confirm', { code: first })).status).toBe(
      400,
    );
    later();
    await partner('POST', '/api/people/me/email', { email: 'edward@example.com' });
    // Another person's code is no use here
    expect(
      (await owner('POST', '/api/people/me/email/confirm', { code: sixDigits(mails.at(-1)!.text) }))
        .status,
    ).toBe(400);
    expect(
      (
        await partner('POST', '/api/people/me/email/confirm', {
          code: sixDigits(mails.at(-1)!.text),
        })
      ).body,
    ).toMatchObject({ email: 'edward@example.com', notifyService: 'mobile_app_edward' });
    later();

    // With both a phone and an address and no choice made, the code goes to both
    notices.length = 0;
    mails.length = 0;
    const answer = (await forgot('Edward')).body;
    await expect.poll(() => mails.length).toBe(1);
    expect(mails[0]).toMatchObject({
      to: 'edward@example.com',
      subject: 'Allotment password code',
    });
    expect(notices).toHaveLength(1);
    expect(sixDigits(notices[0].message)).toBe(sixDigits(mails[0].text));
    // Within a minute nothing more is sent, and the answer is the same
    expect((await forgot('Edward')).body).toEqual(answer);
    await new Promise((r) => setTimeout(r, 50));
    expect([mails.length, notices.length]).toEqual([1, 1]);
    later();

    // Email only, and the emailed code resets the password
    expect(
      (await partner('PUT', '/api/people/me/code-channel', { channel: 'email' })).body.codeChannel,
    ).toBe('email');
    expect(
      (await partner('PUT', '/api/people/me/code-channel', { channel: 'pigeon' })).status,
    ).toBe(400);
    await forgot('Edward');
    await expect.poll(() => mails.length).toBe(2);
    expect(notices).toHaveLength(1);
    const reset = browser();
    expect(
      (
        await reset('POST', '/api/auth/reset', {
          name: 'Edward',
          code: sixDigits(mails[1].text),
          password: 'emailed-reset-1',
        })
      ).status,
    ).toBe(204);
    later();

    // Phone only; and when notifications are off on this server, the address they have
    await reset('PUT', '/api/people/me/code-channel', { channel: 'phone' });
    await forgot('Edward');
    await expect.poll(() => notices.length).toBe(2);
    expect(mails).toHaveLength(2);
    later();
    notifyOn = false;
    try {
      await forgot('Edward');
      await expect.poll(() => mails.length).toBe(3);
      expect(notices).toHaveLength(2);
    } finally {
      notifyOn = true;
    }
    later();

    // Removing the address: codes go to the phone again
    expect((await reset('DELETE', '/api/people/me/email')).body).toMatchObject({ email: null });
    await reset('PUT', '/api/people/me/code-channel', { channel: 'email' });
    await forgot('Edward');
    await expect.poll(() => notices.length).toBe(3);
    expect(mails).toHaveLength(3);
    later();

    // The administrator's code goes to their email and stays in the Log
    await owner('POST', '/api/people/me/email', { email: 'tristan@example.com' });
    await owner('POST', '/api/people/me/email/confirm', { code: sixDigits(mails.at(-1)!.text) });
    later();
    await forgot('Tristan');
    await expect.poll(() => mails.length).toBe(5);
    const adminCode = /Password reset code for Tristan: ([A-Z2-9-]{19})/.exec(logged.at(-1)!)![1];
    expect(mails[4]).toMatchObject({ to: 'tristan@example.com' });
    expect(mails[4].text).toContain(adminCode);
    expect(mails[4].text).toContain('24 hours');
    // Partner signs in again for the tests that follow
    expect(
      (await partner('POST', '/api/auth/login', { name: 'Edward', password: 'emailed-reset-1' }))
        .status,
    ).toBe(204);
  });

  it("sends a budget's reminders to its own person, where they chose", async () => {
    // Edward has his phone; Tristan only an email address
    const settings = (await partner('GET', '/api/reminders')).body;
    expect(settings).toEqual({
      available: true,
      viaGateway: true,
      enabled: false,
      service: null,
      showDetails: false,
    });
    expect((await partner('POST', '/api/reminders/test')).status).toBe(409);
    // A budget behind the gateway never names a destination
    expect(
      (await partner('PUT', '/api/reminders', { service: 'mobile_app_other', showDetails: false }))
        .status,
    ).toBe(400);
    expect(
      (await partner('PUT', '/api/reminders', { enabled: true, showDetails: false })).body,
    ).toMatchObject({ enabled: true, viaGateway: true });
    notices.length = 0;
    mails.length = 0;
    expect((await partner('POST', '/api/reminders/test')).body).toEqual({ sent: true });
    expect(notices).toEqual([
      { service: 'mobile_app_edward', message: 'Bill reminders will arrive here.' },
    ]);
    await owner('PUT', '/api/reminders', { enabled: true, showDetails: false });
    expect((await owner('POST', '/api/reminders/test')).status).toBe(200);
    expect(mails).toEqual([
      {
        to: 'tristan@example.com',
        subject: 'Allotment: test',
        text: 'Bill reminders will arrive here.',
      },
    ]);
    expect(notices).toHaveLength(1);

    // His own choice, made with the gateway: email chosen but none saved, so his phone still
    expect(
      (await partner('PUT', '/api/people/me/reminder-channel', { channel: 'email' })).body,
    ).toMatchObject({ reminderChannel: 'email' });
    await partner('POST', '/api/reminders/test');
    expect(notices).toHaveLength(2);

    // Nothing delivered: the budget says so and (for the hourly timer) marks nothing
    notifyFails = true;
    try {
      const failed = await partner('POST', '/api/reminders/test');
      expect(failed.status).toBe(422);
      expect(failed.body.error).toMatch(/could not be reached/);
    } finally {
      notifyFails = false;
    }
    // Nowhere to send
    await partner('DELETE', '/api/people/me/phone');
    const nowhere = await partner('POST', '/api/reminders/test');
    expect(nowhere.status).toBe(422);
    expect(nowhere.body.error).toMatch(/Password codes/);

    // The public port has no way in
    expect(
      (
        await fetch(`${base}/notify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 't', message: 'm' }),
        })
      ).status,
    ).toBe(404);
  });

  it('disables a person: signed out, no sign-in, budget stopped', async () => {
    expect((await owner('POST', `/api/people/${partnerId}/disable`)).body).toMatchObject({
      disabled: true,
      running: false,
    });
    expect((await partner('GET', '/api/accounts')).status).toBe(401);
    expect(
      (await partner('POST', '/api/auth/login', { name: 'Edward', password: 'emailed-reset-1' }))
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

  it('revokes tokens even when the budget was down while the password changed', async () => {
    const made = await owner('POST', '/api/access-tokens', { name: 'Again', days: 7 });
    const token = made.body.token as string;
    const auth = { Authorization: `Bearer ${token}` };
    expect((await stranger('GET', '/api/accounts', undefined, auth)).status).toBe(200);
    const admin = store.people().find((p) => p.isAdmin)!;
    budgets.stop(admin.id);
    expect(
      (
        await owner('POST', '/api/auth/change-password', {
          currentPassword: 'owner-pass-2',
          newPassword: 'owner-pass-3',
        })
      ).status,
    ).toBe(204);
    expect(store.revocationPending(admin.id)).toBe(true);
    await budgets.start(store.person(admin.id)!);
    // The gateway finishes the revocation before letting the old token through
    expect((await stranger('GET', '/api/accounts', undefined, auth)).status).toBe(401);
    expect(store.revocationPending(admin.id)).toBe(false);
    // A token made afterwards works
    const fresh = await owner('POST', '/api/access-tokens', { name: 'New', days: 7 });
    expect(
      (
        await stranger('GET', '/api/accounts', undefined, {
          Authorization: `Bearer ${fresh.body.token}`,
        })
      ).status,
    ).toBe(200);
  }, 120_000);
});
