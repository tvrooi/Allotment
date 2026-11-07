import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  householdEvents,
  householdGroups,
  householdPeople,
  householdPoolAccounts,
  payees,
  transactions,
} from '../db/schema.js';
import { reportsRouter } from './reports.js';

// The categorising worklist says whose money each group is: the owner's budget first, a
// household account's rows apart, and a payee recorded as a housemate's money marked. Mock data.

let server: Server;
let url: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use('/api/reports', reportsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/reports/uncategorised-payees`;
  db.insert(accounts)
    .values([
      { id: 'spend', name: 'Spending', type: 'checking' },
      { id: 'pool', name: '2Up', type: 'checking' },
      { id: 'pool-saver', name: '2Up Bills', type: 'savings' },
      { id: 'super', name: 'Super', type: 'retirement', isOffBudget: 1 },
    ])
    .run();
  db.insert(householdGroups)
    .values({ id: 'home', name: 'Home', currency: 'AUD', accountId: 'pool' })
    .run();
  db.insert(householdPoolAccounts).values({ groupId: 'home', accountId: 'pool-saver' }).run();
  db.insert(householdPeople)
    .values([
      { id: 'me', groupId: 'home', name: 'Me', isSelf: 1 },
      { id: 'juno', groupId: 'home', name: 'Juno', isSelf: 0 },
    ])
    .run();
  db.insert(payees)
    .values([
      { id: 'juno-p', name: 'Juno B' },
      { id: 'power', name: 'Power Co' },
      { id: 'cafe', name: 'Cafe' },
    ])
    .run();
  const tx = (
    id: string,
    accountId: string,
    amount: number,
    payeeId: string,
    categoryId?: string,
  ) =>
    db
      .insert(transactions)
      .values({ id, accountId, date: '2026-10-01', amount, payeeId, categoryId })
      .run();
  // Juno's earlier deposit, recorded as her contribution, teaches that the payee is hers
  tx('recorded', 'pool', 8800, 'juno-p', undefined);
  db.insert(householdEvents)
    .values({
      id: 'e1',
      groupId: 'home',
      kind: 'contribution',
      date: '2026-10-01',
      description: 'Bills',
      amount: 8800,
      payerId: 'juno',
      transactionId: 'recorded',
    })
    .run();
  tx('c1', 'spend', -450, 'cafe');
  tx('j1', 'spend', 2500, 'juno-p');
  tx('p1', 'pool-saver', -11400, 'power');
  tx('p2', 'pool', -10700, 'power');
  tx('s1', 'super', 1000, 'cafe');
});

afterAll(() => server.close());

describe('uncategorised payees', () => {
  it("lists the owner's budget first, keeps household and off-budget rows apart and marks housemate money", async () => {
    const body = await (await fetch(url)).json();
    const short = body.payees.map((p: Record<string, unknown>) => ({
      payee: p.payeeName,
      scope: p.scope,
      household: (p.household as { name: string } | null)?.name ?? null,
      housemate: (p.housemate as { personName: string } | null)?.personName ?? null,
      count: p.count,
    }));
    expect(short).toEqual([
      { payee: 'Cafe', scope: 'personal', household: null, housemate: null, count: 1 },
      { payee: 'Juno B', scope: 'personal', household: null, housemate: 'Juno', count: 1 },
      { payee: 'Power Co', scope: 'household', household: 'Home', housemate: null, count: 2 },
      { payee: 'Juno B', scope: 'household', household: 'Home', housemate: 'Juno', count: 1 },
      { payee: 'Cafe', scope: 'off_budget', household: null, housemate: null, count: 1 },
    ]);
  });
});
