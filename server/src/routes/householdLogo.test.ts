import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, transactions } from '../db/schema.js';
import { householdsRouter } from './households.js';
import { transactionsRouter } from './transactions.js';
import { createBackup, parseBackup, restoreBackup } from '../services/backupService.js';

// A household's logo, and the household each payment in the register is shared with
// (docs/HOUSEHOLDS.md). Mock data only.

let server: Server;
let base: string;
let groupId: string;
const logo = 'data:image/png;base64,iVBORw0KGgo=';

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/households', householdsRouter);
  app.use('/api/transactions', transactionsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  db.insert(accounts).values({ id: 'spend', name: 'Spending', type: 'checking' }).run();
  for (const [id, amount, payeeName, date] of [
    ['groceries', -4200, 'Mock Grocer', '2026-10-01'],
    ['coffee', -550, 'Mock Cafe', '2026-10-02'],
    ['pay', 250000, 'Mock Employer', '2026-10-03'],
  ] as const)
    db.insert(transactions).values({ id, accountId: 'spend', date, amount, payeeName }).run();
  const created = await call('/households', {
    name: 'Home',
    currency: 'AUD',
    accountId: null,
    people: ['Me', 'Housemate'],
    selfIndex: 0,
  });
  expect(created.status).toBe(201);
  groupId = created.data.group.id;
});
afterAll(() => server.close());

async function call(path: string, body?: unknown, method = body !== undefined ? 'POST' : 'GET') {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, data: await response.json() };
}
const setLogo = (value: unknown, id = groupId) => call(`/households/${id}/logo`, value, 'PUT');
const listed = async () => (await call('/households')).data[0];

describe('household logo', () => {
  it('starts without one', async () => {
    expect((await listed()).logo).toBeNull();
  });

  it('sets, replaces and removes it', async () => {
    expect((await setLogo({ logo })).status).toBe(200);
    expect((await listed()).logo).toBe(logo);
    expect((await call(`/households/${groupId}`)).data.group.logo).toBe(logo);
    const other = 'data:image/webp;base64,AAAA';
    expect((await setLogo({ logo: other })).status).toBe(200);
    expect((await listed()).logo).toBe(other);
    expect((await setLogo({ logo: null })).status).toBe(200);
    expect((await listed()).logo).toBeNull();
  });

  it('accepts only small PNG, JPEG or WebP images', async () => {
    for (const bad of [
      { logo: 'data:image/svg+xml;base64,AAAA' },
      { logo: 'https://example.com/logo.png' },
      { logo: `data:image/png;base64,${'A'.repeat(200_001)}` },
      {},
    ])
      expect((await setLogo(bad)).status).toBe(400);
    expect((await listed()).logo).toBeNull();
  });

  it('answers 404 for a household that does not exist', async () => {
    expect((await setLogo({ logo }, 'missing')).status).toBe(404);
  });

  it('stays out of what a combined household shows the other person', async () => {
    await setLogo({ logo });
    const shared = await call(`/households/${groupId}/shared-export`);
    expect(shared.status).toBe(200);
    expect(JSON.stringify(shared.data)).not.toContain(logo);
  });

  it('survives a backup and restore', async () => {
    await setLogo({ logo });
    const backup = parseBackup(createBackup());
    await setLogo({ logo: null });
    restoreBackup(backup);
    expect((await listed()).logo).toBe(logo);
  });
});

describe('shared payments in the register', () => {
  it('shows no household for a payment that is not shared', async () => {
    const rows = (await call('/transactions')).data as { id: string; household: unknown }[];
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row.household).toBeNull();
  });

  it('shows the household and its entry once a payment is shared, and clears it on removal', async () => {
    const shared = await call(`/households/${groupId}/share`, { transactionIds: ['groceries'] });
    expect(shared.data.shared).toBe(1);
    const eventId = shared.data.results[0].eventId as string;
    const byId = async (query = '') =>
      new Map(
        ((await call(`/transactions${query}`)).data as { id: string; household: unknown }[]).map(
          (r) => [r.id, r.household],
        ),
      );
    let rows = await byId();
    expect(rows.get('groceries')).toEqual({ id: groupId, eventId, kind: 'expense' });
    expect(rows.get('coffee')).toBeNull();
    // Filters on columns the household entry also has (date, amount, description) still work
    rows = await byId(
      '?direction=debit&min_amount=1000&from=2026-10-01&to=2026-10-31&search=Grocer',
    );
    expect([...rows.keys()]).toEqual(['groceries']);
    expect(rows.get('groceries')).toEqual({ id: groupId, eventId, kind: 'expense' });

    expect(
      (await call(`/households/${groupId}/events/${eventId}`, undefined, 'DELETE')).status,
    ).toBe(200);
    expect((await byId()).get('groceries')).toBeNull();
  });
});
