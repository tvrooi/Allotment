import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import express from 'express';
import fc from 'fast-check';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import { accounts, categories, categoryGroups, transactions } from '../db/schema.js';
import { householdsRouter } from './households.js';
import { recordEvent, snapshot } from '../services/householdService.js';
import { householdBreakdown } from '../services/householdReport.js';

// Household reports by month, person and category (SPL-05). Mock data only.

let server: Server;
let base: string;
let seq = 0;
beforeAll(async () => {
  migrate(db, { migrationsFolder: 'src/db/migrations' });
  const app = express();
  app.use(express.json());
  app.use('/api/households', householdsRouter);
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/households`;
  db.insert(accounts)
    .values([
      { id: 'mine', name: 'Spending', type: 'checking' },
      { id: 'pool', name: 'Household', type: 'checking' },
    ])
    .run();
  db.insert(categoryGroups).values({ id: 'g', name: 'Bills' }).run();
  db.insert(categories)
    .values([
      { id: 'food', groupId: 'g', name: 'Groceries' },
      { id: 'power', groupId: 'g', name: 'Power' },
    ])
    .run();
});
afterAll(() => server.close());

async function newGroup(accountId: string | null = null) {
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Report ${++seq}`,
      currency: 'AUD',
      accountId,
      people: ['Me', 'Ana', 'Bo'],
      selfIndex: 0,
    }),
  });
  const data = await res.json();
  return {
    id: data.group.id as string,
    ids: data.people.map((p: { id: string }) => p.id) as string[],
  };
}
const equal = (ids: string[]) => ids.map((personId) => ({ personId, value: 1 }));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('household breakdown (SPL-05)', () => {
  it('adds up the same way by month, person and category, for any entries', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            amount: fc.integer({ min: 1, max: 500_000 }),
            payer: fc.integer({ min: 0, max: 2 }),
            members: fc.subarray([0, 1, 2], { minLength: 1 }),
            day: fc.integer({ min: 1, max: 28 }),
            month: fc.integer({ min: 8, max: 10 }),
            refund: fc.boolean(),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        async (entries) => {
          {
            const h = await newGroup();
            for (const [i, e] of entries.entries()) {
              const date = `2026-${String(e.month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`;
              db.transaction(() => {
                const id = recordEvent(h.id, {
                  kind: 'expense',
                  date,
                  description: `Entry ${i}`,
                  amount: e.amount,
                  payerId: h.ids[e.payer],
                  mode: 'equal',
                  shares: equal(e.members.map((m) => h.ids[m])),
                });
                if (e.refund)
                  recordEvent(h.id, {
                    kind: 'refund',
                    date,
                    description: `Refund ${i}`,
                    reversesId: id,
                    amount: Math.max(1, Math.floor(e.amount / 3)),
                  });
              });
            }
            const r = householdBreakdown(snapshot(h.id), '0000-01-01', '9999-12-31');
            expect(sum(r.byMonth.map((m) => m.household))).toBe(r.total);
            expect(sum(r.byCategory.map((c) => c.household))).toBe(r.total);
            expect(sum(r.byPerson.map((p) => p.paid))).toBe(r.total);
            expect(sum(r.byPerson.map((p) => p.share))).toBe(r.total);
            expect(sum(r.byPerson.map((p) => p.net))).toBe(0);
            expect(sum(r.byMonth.map((m) => m.myShare))).toBe(r.myShare);
            expect(sum(r.byCategory.map((c) => c.myShare))).toBe(r.myShare);
            expect(r.byMonth.map((m) => m.month)).toEqual(
              [...r.byMonth.map((m) => m.month)].sort(),
            );
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  it('breaks spending down by month, person and category, and leaves repayments out', async () => {
    const h = await newGroup();
    const [me, ana, bo] = h.ids;
    db.insert(transactions)
      .values([
        { id: 'r-food', accountId: 'mine', date: '2026-09-05', amount: -9000, categoryId: 'food' },
        {
          id: 'r-power',
          accountId: 'mine',
          date: '2026-10-02',
          amount: -6000,
          categoryId: 'power',
        },
        { id: 'r-none', accountId: 'mine', date: '2026-10-03', amount: -3000 },
      ])
      .run();
    const add = (body: object) => db.transaction(() => recordEvent(h.id, body));
    const common = { kind: 'expense', mode: 'equal', shares: equal([me, ana, bo]), payerId: me };
    add({
      ...common,
      date: '2026-09-05',
      description: 'Food',
      amount: 9000,
      transactionId: 'r-food',
    });
    add({
      ...common,
      date: '2026-10-02',
      description: 'Power',
      amount: 6000,
      transactionId: 'r-power',
    });
    add({
      ...common,
      date: '2026-10-03',
      description: 'No category',
      amount: 3000,
      transactionId: 'r-none',
    });
    // Ana pays for Me and Ana by hand: no bank payment, so no category
    add({
      ...common,
      date: '2026-10-10',
      description: 'Takeaway',
      amount: 2000,
      payerId: ana,
      shares: equal([me, ana]),
    });
    // A repayment is not spending
    add({
      kind: 'settlement',
      date: '2026-10-11',
      description: 'Repayment',
      amount: 1000,
      payerId: bo,
      recipientId: me,
    });
    const r = householdBreakdown(snapshot(h.id), '2026-09-01', '2026-10-31');
    expect(r.total).toBe(20000);
    expect(r.myShare).toBe(3000 + 2000 + 1000 + 1000);
    expect(r.byMonth).toEqual([
      { month: '2026-09', household: 9000, myShare: 3000 },
      { month: '2026-10', household: 11000, myShare: 4000 },
    ]);
    expect(r.byPerson).toEqual([
      { personId: me, name: 'Me', paid: 18000, share: 7000, net: 11000 },
      { personId: ana, name: 'Ana', paid: 2000, share: 7000, net: -5000 },
      { personId: bo, name: 'Bo', paid: 0, share: 6000, net: -6000 },
    ]);
    // Largest first, Uncategorised last even though it is the biggest after Groceries
    expect(r.byCategory.map((c) => [c.name, c.household])).toEqual([
      ['Groceries', 9000],
      ['Power', 6000],
      ['Uncategorised', 5000],
    ]);
    // The range is inclusive of both ends and leaves other days out
    const october = householdBreakdown(snapshot(h.id), '2026-10-03', '2026-10-10');
    expect(october.total).toBe(5000);
    expect(october.byMonth).toEqual([{ month: '2026-10', household: 5000, myShare: 1000 + 1000 }]);
  });

  it('counts what the household account paid under no person, and a refund against the original', async () => {
    const h = await newGroup('pool');
    const [me, ana, bo] = h.ids;
    const id = db.transaction(() =>
      recordEvent(h.id, {
        kind: 'expense',
        date: '2026-10-01',
        description: 'Rent',
        amount: 30000,
        payerId: null,
        mode: 'equal',
        shares: equal([me, ana, bo]),
      }),
    );
    db.transaction(() =>
      recordEvent(h.id, {
        kind: 'refund',
        date: '2026-10-05',
        description: 'Rent credit',
        reversesId: id,
        amount: 3000,
      }),
    );
    const r = householdBreakdown(snapshot(h.id), '2026-10-01', '2026-10-31');
    expect(r.total).toBe(27000);
    expect(r.byPerson.at(-1)).toEqual({
      personId: null,
      name: 'Household account',
      paid: 27000,
      share: 0,
      net: 27000,
    });
    // $300 split three ways is $100 each; the $30 refund takes $10 off each
    expect(r.byPerson.slice(0, 3).map((p) => p.share)).toEqual([9000, 9000, 9000]);
  });

  it('is on the statement, with the same totals as before', async () => {
    const h = await newGroup();
    db.transaction(() =>
      recordEvent(h.id, {
        kind: 'expense',
        date: '2026-10-01',
        description: 'Gas',
        amount: 9000,
        payerId: h.ids[0],
        mode: 'equal',
        shares: equal(h.ids),
      }),
    );
    const statement = await (await fetch(`${base}/${h.id}/statement?from=2026-10-01`)).json();
    expect(statement).toMatchObject({
      householdSpending: 9000,
      personalSpending: 3000,
      byMonth: [{ month: '2026-10', household: 9000, myShare: 3000 }],
      byCategory: [{ categoryId: null, name: 'Uncategorised', household: 9000, myShare: 3000 }],
    });
    expect(statement.byPerson).toHaveLength(3);
    expect((await fetch(`${base}/${h.id}/statement?from=2026-11-01&to=2026-10-01`)).status).toBe(
      400,
    );
  });
});
