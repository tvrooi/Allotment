import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import fc from 'fast-check';
import { inArray } from 'drizzle-orm';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from '../db/index.js';
import {
  accounts,
  categories,
  categoryGroups,
  householdGroups,
  payees,
  transactions,
} from '../db/schema.js';
import { transactionsRouter } from './transactions.js';
import { exportRouter } from './export.js';

// Phase 8 transaction selection (docs/MONARCH-DEVELOPMENT-PHASE.md): the register, its
// summary and the filtered export agree. Mock data only.

let server: Server;
let base: string;

beforeAll(async () => {
  migrate(db, { migrationsFolder: './src/db/migrations' });
  db.insert(accounts)
    .values([
      { id: 'mock', name: 'Mock account', type: 'checking' },
      { id: 'other', name: 'Other account', type: 'checking' },
      { id: 'shared', name: 'Shared account', type: 'checking' },
    ])
    .run();
  db.insert(householdGroups)
    .values({ id: 'home', name: 'Home', currency: 'AUD', accountId: 'shared' })
    .run();
  db.insert(categoryGroups)
    .values([
      { id: 'income', name: 'Income', isIncome: 1 },
      { id: 'living', name: 'Living' },
    ])
    .run();
  db.insert(categories)
    .values([
      { id: 'paychecks', name: 'Paychecks', groupId: 'income' },
      { id: 'groceries', name: 'Groceries', groupId: 'living' },
      { id: 'dining', name: 'Dining', groupId: 'living' },
    ])
    .run();
  db.insert(payees)
    .values([
      { id: 'grocer', name: 'Mock grocer' },
      { id: 'cafe', name: 'Mock cafe' },
    ])
    .run();
  // The brief's four-record fixture
  const row = (r: Partial<typeof transactions.$inferInsert> & { id: string; amount: number }) => ({
    accountId: 'mock',
    date: '2026-10-01',
    ...r,
  });
  db.insert(transactions)
    .values([
      row({
        id: 'pay',
        date: '2026-10-05',
        amount: 200000,
        categoryId: 'paychecks',
        payeeName: 'Mock payroll',
      }),
      row({
        id: 'groc-oct',
        date: '2026-10-07',
        amount: -12000,
        categoryId: 'groceries',
        payeeId: 'grocer',
        payeeName: 'Mock grocer',
      }),
      row({
        id: 'cafe',
        date: '2026-10-09',
        amount: -4500,
        categoryId: 'dining',
        payeeId: 'cafe',
        payeeName: 'Mock cafe',
      }),
      row({
        id: 'groc-sep',
        date: '2026-09-07',
        amount: -9000,
        categoryId: 'groceries',
        payeeId: 'grocer',
        payeeName: 'Mock grocer',
      }),
    ])
    .run();
  const app = express();
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/export', exportRouter);
  server = await new Promise<Server>((r) => {
    const s = app.listen(0, '127.0.0.1', () => r(s));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
afterAll(() => server.close());

async function get<T>(path: string, query = '') {
  const res = await fetch(`${base}${path}${query ? `?${query}` : ''}`);
  return { status: res.status, body: (await res.json()) as T };
}
const register = async (query: string) =>
  (await get<{ id: string }[]>('/transactions', query)).body.map((r) => r.id).sort();
const summary = async (query: string) =>
  (
    await get<{
      count: number;
      leafCount: number;
      moneyIn: number;
      moneyOut: number;
      net: number;
      missingRateCount: number;
      firstDate: string | null;
      lastDate: string | null;
    }>('/transactions/summary', query)
  ).body;
async function exported(query: string) {
  const res = await fetch(`${base}/export/transactions/csv${query ? `?${query}` : ''}`);
  expect(res.status).toBe(200);
  const lines = (await res.text()).split('\n').slice(1).filter(Boolean);
  return lines.map((l) => {
    const cells = l.split(',');
    return { date: cells[0], amount: Math.round(Number(cells[5]) * 100) };
  });
}

/** Insert rows for one test and remove them afterwards */
async function withRows(rows: (typeof transactions.$inferInsert)[], fn: () => Promise<void>) {
  db.insert(transactions).values(rows).run();
  try {
    await fn();
  } finally {
    db.delete(transactions)
      .where(
        inArray(
          transactions.id,
          rows.map((r) => r.id!),
        ),
      )
      .run();
  }
}

describe('phase 8 fixture', () => {
  it('combines account, debit and amount over 100 to return only the 120 expense', async () => {
    const q = 'account_ids=mock&direction=debit&min_amount=10001';
    expect(await register(q)).toEqual(['groc-oct']);
    expect(await summary(q)).toMatchObject({ count: 1, moneyIn: 0, moneyOut: 12000 });
  });

  it('payee search returns both grocery entries totalling 210', async () => {
    const q = 'search=grocer';
    expect(await register(q)).toEqual(['groc-oct', 'groc-sep']);
    expect(await summary(q)).toMatchObject({
      count: 2,
      moneyOut: 21000,
      firstDate: '2026-09-07',
      lastDate: '2026-10-07',
    });
    expect(await register('payee_ids=grocer')).toEqual(['groc-oct', 'groc-sep']);
  });

  it('reports October money in and out and the all-time totals', async () => {
    expect(await summary('from=2026-10-01&to=2026-10-31')).toMatchObject({
      count: 3,
      moneyIn: 200000,
      moneyOut: 16500,
      net: 183500,
    });
    expect(await summary('')).toMatchObject({ count: 4, moneyOut: 25500, net: 174500 });
  });

  it('treats amount and date bounds as inclusive and month as its real last day', async () => {
    expect(await register('min_amount=12000&max_amount=12000')).toEqual(['groc-oct']);
    expect(await register('min_amount=12001')).toEqual(['pay']);
    expect(await register('max_amount=4500')).toEqual(['cafe']);
    expect(await register('from=2026-10-07&to=2026-10-07')).toEqual(['groc-oct']);
    await withRows(
      [
        { id: 'feb-end', accountId: 'mock', date: '2026-02-28', amount: -1 },
        { id: 'mar-start', accountId: 'mock', date: '2026-03-01', amount: -1 },
      ],
      async () => {
        expect(await register('month=2026-02')).toEqual(['feb-end']);
      },
    );
  });

  it('returns an empty selection, not everything, when nothing matches', async () => {
    expect(await register('payee_ids=nobody')).toEqual([]);
    expect(await summary('payee_ids=nobody')).toMatchObject({
      count: 0,
      moneyIn: 0,
      moneyOut: 0,
      firstDate: null,
    });
    expect(await exported('payee_ids=nobody')).toEqual([]);
  });

  it('rejects malformed and contradictory selections', async () => {
    for (const q of [
      'from=2026-02-30',
      'from=2026-10-31&to=2026-10-01',
      'min_amount=-5',
      'min_amount=1.5',
      'min_amount=500&max_amount=100',
      'direction=sideways',
      'month=2026-13',
      'transfers=maybe',
    ]) {
      expect((await get('/transactions', q)).status, q).toBe(400);
      expect((await get('/transactions/summary', q)).status, q).toBe(400);
      expect((await fetch(`${base}/export/transactions/csv?${q}`)).status, q).toBe(400);
    }
  });

  it('selects merchants without a payee record by name, and rows with no payee by an empty name', async () => {
    await withRows(
      [
        {
          id: 'named',
          accountId: 'mock',
          date: '2026-10-25',
          amount: -300,
          payeeName: 'Market stall',
        },
        { id: 'blank', accountId: 'mock', date: '2026-10-25', amount: -200, payeeName: '' },
        { id: 'none', accountId: 'mock', date: '2026-10-25', amount: -100 },
      ],
      async () => {
        const day = 'from=2026-10-25&to=2026-10-25';
        expect(await register(`${day}&payee_name=Market%20stall`)).toEqual(['named']);
        expect(await register(`${day}&payee_name=`)).toEqual(['blank', 'none']);
        expect(await summary(`${day}&payee_name=`)).toMatchObject({ count: 2, moneyOut: 300 });
        expect(await register(`${day}&search=`)).toEqual(['blank', 'named', 'none']);
      },
    );
  });

  it('treats search wildcards literally', async () => {
    expect(await register('search=%25')).toEqual([]);
    expect(await register('search=_')).toEqual([]);
  });
});

describe('selection rules', () => {
  it('shows a split once and counts only its matching parts', async () => {
    await withRows(
      [
        { id: 'split', accountId: 'mock', date: '2026-10-12', amount: -10000, isParent: 1 },
        {
          id: 'split-food',
          accountId: 'mock',
          date: '2026-10-12',
          amount: -7000,
          categoryId: 'groceries',
          parentTransactionId: 'split',
        },
        {
          id: 'split-cafe',
          accountId: 'mock',
          date: '2026-10-12',
          amount: -3000,
          categoryId: 'dining',
          parentTransactionId: 'split',
        },
      ],
      async () => {
        const q = 'category_ids=groceries&from=2026-10-01&to=2026-10-31';
        expect(await register(q)).toEqual(['groc-oct', 'split']);
        expect(await summary(q)).toMatchObject({ count: 2, leafCount: 2, moneyOut: 19000 });
        expect((await exported(q)).map((r) => r.amount).sort()).toEqual([-12000, -7000]);
        // Unfiltered, the parts add up to the parent
        const all = await summary('from=2026-10-12&to=2026-10-12');
        expect(all).toMatchObject({ count: 1, leafCount: 2, moneyOut: 10000 });
        // An amount filter is evaluated on parts, never the parent's total
        expect(await register('min_amount=10000&from=2026-10-12&to=2026-10-12')).toEqual([]);
        expect(await register('min_amount=7000&from=2026-10-12&to=2026-10-12')).toEqual(['split']);
      },
    );
  });

  it('keeps refunds as money in and excludes transfers only when asked', async () => {
    await withRows(
      [
        {
          id: 'refund',
          accountId: 'mock',
          date: '2026-10-15',
          amount: 2000,
          categoryId: 'groceries',
          payeeId: 'grocer',
          payeeName: 'Mock grocer',
        },
        {
          id: 'out',
          accountId: 'mock',
          date: '2026-10-16',
          amount: -50000,
          transferTransactionId: 'in',
        },
        {
          id: 'in',
          accountId: 'other',
          date: '2026-10-16',
          amount: 50000,
          transferTransactionId: 'out',
        },
      ],
      async () => {
        const q = 'from=2026-10-15&to=2026-10-16';
        expect(await summary(q)).toMatchObject({ count: 3, moneyIn: 52000, moneyOut: 50000 });
        expect(await summary(`${q}&transfers=exclude`)).toMatchObject({
          count: 1,
          moneyIn: 2000,
          moneyOut: 0,
        });
        expect(await register(`${q}&direction=credit`)).toEqual(['in', 'refund']);
        expect(await register(`${q}&account_ids=mock,other&transfers=exclude`)).toEqual(['refund']);
        // The cash-flow scope leaves internal transfers out, as reports do
        expect(await register(`${q}&budget_report=1`)).toEqual(['refund']);
      },
    );
  });

  it('keeps household accounts out of the budget scope', async () => {
    await withRows(
      [
        {
          id: 'repay',
          accountId: 'shared',
          date: '2026-10-20',
          amount: 6000,
          categoryId: 'paychecks',
        },
      ],
      async () => {
        expect(await register('from=2026-10-20&to=2026-10-20')).toEqual(['repay']);
        expect(await register('from=2026-10-20&to=2026-10-20&budget_report=1')).toEqual([]);
      },
    );
  });

  it('leaves missing exchange rates out of totals and counts them', async () => {
    await withRows(
      [
        {
          id: 'abroad',
          accountId: 'mock',
          date: '2026-10-21',
          amount: -999,
          mainAmount: null,
          mainAmountSource: 'missing',
        },
      ],
      async () => {
        expect(await summary('from=2026-10-21&to=2026-10-21')).toMatchObject({
          count: 1,
          moneyOut: 0,
          missingRateCount: 1,
        });
      },
    );
  });

  it("filters reconciled state on the register row, using a split parent's for its parts", async () => {
    await withRows(
      [
        {
          id: 'rec',
          accountId: 'mock',
          date: '2026-10-22',
          amount: -100,
          isParent: 1,
          reconciled: 1,
        },
        {
          id: 'rec-part',
          accountId: 'mock',
          date: '2026-10-22',
          amount: -100,
          categoryId: 'groceries',
          parentTransactionId: 'rec',
        },
      ],
      async () => {
        const q = 'from=2026-10-22&to=2026-10-22';
        expect(await register(`${q}&reconciled=1`)).toEqual(['rec']);
        expect(await summary(`${q}&reconciled=1`)).toMatchObject({ count: 1, moneyOut: 100 });
        expect(await summary(`${q}&reconciled=0`)).toMatchObject({ count: 0 });
      },
    );
  });

  it('never writes', async () => {
    const before = db.select().from(transactions).all();
    await summary('search=grocer&direction=debit');
    await exported('search=grocer');
    await register('payee_ids=grocer');
    expect(db.select().from(transactions).all()).toEqual(before);
  });

  it('summary and export always agree with the register for generated selections', async () => {
    const entry = fc.record({
      day: fc.integer({ min: 0, max: 9 }),
      amount: fc.integer({ min: -5000, max: 5000 }),
      category: fc.constantFrom(null, 'groceries', 'dining'),
      account: fc.constantFrom('mock', 'other'),
      split: fc.boolean(),
    });
    const filter = fc.record({
      direction: fc.constantFrom(undefined, 'debit', 'credit'),
      min: fc.option(fc.integer({ min: 0, max: 5000 }), { nil: undefined }),
      category: fc.constantFrom(undefined, 'groceries'),
      account: fc.constantFrom(undefined, 'other'),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(entry, { minLength: 1, maxLength: 12 }), filter, async (es, f) => {
        const rows: (typeof transactions.$inferInsert)[] = [];
        es.forEach((e, i) => {
          const id = `gen-${i}`;
          const date = `2027-01-${String(e.day + 1).padStart(2, '0')}`;
          if (!e.split) {
            rows.push({ id, accountId: e.account, date, amount: e.amount, categoryId: e.category });
            return;
          }
          rows.push({ id, accountId: e.account, date, amount: e.amount, isParent: 1 });
          rows.push({
            id: `${id}-a`,
            accountId: e.account,
            date,
            amount: e.amount - 11,
            categoryId: 'groceries',
            parentTransactionId: id,
          });
          rows.push({
            id: `${id}-b`,
            accountId: e.account,
            date,
            amount: 11,
            categoryId: e.category,
            parentTransactionId: id,
          });
        });
        const params = new URLSearchParams({ from: '2027-01-01', to: '2027-01-31' });
        if (f.direction) params.set('direction', f.direction);
        if (f.min !== undefined) params.set('min_amount', String(f.min));
        if (f.category) params.set('category_ids', f.category);
        if (f.account) params.set('account_ids', f.account);
        const q = params.toString();
        await withRows(rows, async () => {
          // Expected leaves, computed independently
          const leaves = rows.filter(
            (r) =>
              !r.isParent &&
              (!f.direction || (f.direction === 'debit' ? r.amount < 0 : r.amount > 0)) &&
              (f.min === undefined || Math.abs(r.amount) >= f.min) &&
              (!f.category || r.categoryId === f.category) &&
              (!f.account || r.accountId === f.account),
          );
          const expectedRegister = [
            ...new Set(leaves.map((r) => r.parentTransactionId ?? r.id!)),
          ].sort();
          expect(await register(q)).toEqual(expectedRegister);
          const s = await summary(q);
          expect(s.count).toBe(expectedRegister.length);
          expect(s.leafCount).toBe(leaves.length);
          expect(s.moneyIn - s.moneyOut).toBe(leaves.reduce((t, r) => t + r.amount, 0));
          const csv = await exported(q);
          expect(csv.length).toBe(leaves.length);
          expect(csv.reduce((t, r) => t + r.amount, 0)).toBe(s.net);
        });
      }),
      { numRuns: 40 },
    );
  });
});
