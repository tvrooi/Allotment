import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { Budgets, type Launch } from './budgets.js';
import { createNotifyListener } from './notifyListener.js';
import { GatewayStore, type Person } from './store.js';

// Reminders for separate budgets (D2b, docs/MULTI-USER-EMAIL-AND-REMINDERS.md): what the
// gateway's loopback listener lets a budget send, and to whom. Made-up people only.

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flybudget-notify-'));
const store = new GatewayStore(path.join(dir, 'people.db'));
const add = (name: string) =>
  store.addPerson({ name, isAdmin: false, dbPath: `/x/${name}.db`, keyPath: '/x/key' });
/** Saves a destination as confirming it would */
const confirm = (p: Person, destination: 'phone' | 'email', address: string) =>
  store.confirmDestination(
    p.id,
    destination,
    store.issueDestinationCode(p.id, destination, address),
  );

const edward = add('Edward');
const sam = add('Sam');
const tokens = new Map([
  ['edward-token', edward.id],
  ['sam-token', sam.id],
]);
const budgets = { personForNotifyToken: (t: string) => tokens.get(t) } as unknown as Budgets;

const notices: { service: string; title: string; message: string }[] = [];
const mails: { to: string; subject: string; text: string }[] = [];
let failing: 'phone' | 'email' | 'both' | null = null;
let notifyOn = true;
let server: Server;
let base: string;

beforeAll(async () => {
  const app = createNotifyListener({
    store,
    budgets,
    notify: async (service, title, message) => {
      if (failing === 'phone' || failing === 'both') throw new Error('unreachable');
      notices.push({ service, title, message });
    },
    canNotify: () => notifyOn,
    mail: async (to, subject, text) => {
      if (failing === 'email' || failing === 'both') throw new Error('unreachable');
      mails.push({ to, subject, text });
    },
  });
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => {
  server.close();
  store.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  notices.length = 0;
  mails.length = 0;
  failing = null;
  notifyOn = true;
});

const reminder = { title: 'Allotment: coming up', message: 'A scheduled item is due tomorrow.' };
const post = async (token: string | null, body: unknown = reminder) => {
  const res = await fetch(`${base}/notify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return res.status;
};

describe('the notify listener', () => {
  it('sends only to the person whose budget holds the token', async () => {
    confirm(edward, 'phone', 'mobile_app_edward');
    confirm(sam, 'email', 'sam@example.com');
    expect(await post('edward-token')).toBe(204);
    expect(notices).toEqual([{ service: 'mobile_app_edward', ...reminder }]);
    expect(mails).toEqual([]);
    expect(await post('sam-token')).toBe(204);
    // Sam has no phone: his email, with the title as the subject
    expect(mails).toEqual([
      { to: 'sam@example.com', subject: reminder.title, text: reminder.message },
    ]);
    expect(notices).toHaveLength(1);
  });

  it('refuses a missing or unknown token, and a disabled person', async () => {
    expect(await post(null)).toBe(401);
    expect(await post('someone-else')).toBe(401);
    expect(await post('Edward')).toBe(401);
    store.setDisabled(sam.id, true);
    try {
      expect(await post('sam-token')).toBe(401);
    } finally {
      store.setDisabled(sam.id, false);
    }
    expect([notices.length, mails.length]).toEqual([0, 0]);
  });

  it('takes a title and a message, nothing else and nothing oversized', async () => {
    for (const body of [
      { ...reminder, to: 'other@example.com' },
      { ...reminder, service: 'mobile_app_other' },
      { title: reminder.title },
      { ...reminder, title: 'x'.repeat(101) },
      { ...reminder, title: 'Allotment\r\nBcc: other@example.com' },
      { ...reminder, message: 'x'.repeat(2001) },
      { ...reminder, message: '' },
    ])
      expect(await post('edward-token', body)).toBe(400);
    expect(await post('edward-token', '{not json')).toBe(400);
    expect(await post('edward-token', { ...reminder, message: 'x'.repeat(20_000) })).toBe(413);
    expect(notices).toEqual([]);
  });

  it('goes where the person chose: their phone by default, email or both', async () => {
    confirm(edward, 'email', 'edward@example.com');
    await post('edward-token');
    expect([notices.length, mails.length]).toEqual([1, 0]);
    store.setChannel(edward.id, 'reminders', 'email');
    await post('edward-token');
    expect([notices.length, mails.length]).toEqual([1, 1]);
    store.setChannel(edward.id, 'reminders', 'both');
    await post('edward-token');
    expect([notices.length, mails.length]).toEqual([2, 2]);
    // Notifications turned off here: email only, rather than nothing
    store.setChannel(edward.id, 'reminders', 'phone');
    notifyOn = false;
    await post('edward-token');
    expect([notices.length, mails.length]).toEqual([2, 3]);
  });

  it('answers 409 with nowhere to send, and 422 when nothing could be delivered', async () => {
    store.removeDestination(sam.id, 'email');
    expect(await post('sam-token')).toBe(409);
    // Both chosen and one fails: delivered, so the budget marks it and never sends it twice
    store.setChannel(edward.id, 'reminders', 'both');
    failing = 'email';
    expect(await post('edward-token')).toBe(204);
    expect(notices).toHaveLength(1);
    failing = 'both';
    expect(await post('edward-token')).toBe(422);
  });

  it('has nothing but /notify', async () => {
    expect((await fetch(`${base}/api/health`)).status).toBe(404);
    expect((await fetch(`${base}/notify`)).status).toBe(404);
  });
});

describe('notify tokens', () => {
  it('are new on each launch, and stop working when the budget stops', async () => {
    const given: string[] = [];
    const launch: Launch = (_p, _port, _secret, notifyToken) => {
      given.push(notifyToken);
      return { stop: () => {}, exited: new Promise(() => {}) };
    };
    // Nothing listens on these ports: the health wait gives up at once
    const b = new Budgets(launch, 1, 0);
    void b.start(edward).catch(() => {});
    void b.start(sam).catch(() => {});
    expect(given).toHaveLength(2);
    expect(given[0]).not.toBe(given[1]);
    expect(b.personForNotifyToken(given[0])).toBe(edward.id);
    expect(b.personForNotifyToken(given[1])).toBe(sam.id);
    expect(b.personForNotifyToken(given[0].slice(1))).toBeUndefined();
    b.stop(edward.id);
    expect(b.personForNotifyToken(given[0])).toBeUndefined();
    void b.start(edward).catch(() => {});
    expect(b.personForNotifyToken(given[0])).toBeUndefined();
    expect(b.personForNotifyToken(given[2])).toBe(edward.id);
  });
});
